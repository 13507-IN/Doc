const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const Item = require('../models/Item');
const { cloudinary, configured: cloudinaryConfigured } = require('../config/cloudinary');

const APPLY_FLAG = '--apply';
const CONFIRM_FLAG = '--confirm-private-migration';
const DELIVERY_TYPES = ['upload', 'private', 'authenticated'];

function getHttpStatus(error) {
  return error?.http_code || error?.error?.http_code || error?.statusCode;
}

function getCloudinaryResource(publicId, resourceType, deliveryType) {
  return new Promise((resolve, reject) => {
    cloudinary.api.resource(
      publicId,
      (error, result) => (error ? reject(error) : resolve(result)),
      { resource_type: resourceType, type: deliveryType }
    );
  });
}

function renameAsAuthenticated(publicId, resourceType, deliveryType) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.rename(
      publicId,
      publicId,
      (error, result) => (error ? reject(error) : resolve(result)),
      {
        resource_type: resourceType,
        type: deliveryType,
        to_type: 'authenticated',
        invalidate: true
      }
    );
  });
}

async function locateAsset(publicId, resourceType) {
  const found = [];
  for (const deliveryType of DELIVERY_TYPES) {
    try {
      const resource = await getCloudinaryResource(publicId, resourceType, deliveryType);
      found.push({ deliveryType, resource });
    } catch (error) {
      if (getHttpStatus(error) !== 404) throw error;
    }
  }
  return found;
}

function groupLegacyItems(items) {
  const groups = new Map();
  for (const item of items) {
    const metadata = item.metadata || {};
    const publicId = metadata.cloudinaryPublicId;
    if (typeof publicId !== 'string' || !publicId.trim()) continue;

    const resourceType = metadata.cloudinaryResourceType ||
      (['pdf', 'document'].includes(item.type) ? 'raw' : 'image');
    if (!['image', 'raw', 'video'].includes(resourceType)) continue;

    const key = `${resourceType}:${publicId}`;
    if (!groups.has(key)) {
      groups.set(key, {
        publicId,
        resourceType,
        items: [],
        format: metadata.cloudinaryFormat || ''
      });
    }
    const group = groups.get(key);
    group.items.push(item);
    if (!group.format && metadata.cloudinaryFormat) {
      group.format = metadata.cloudinaryFormat;
    }
  }
  return [...groups.values()];
}

async function makeAssetPrivate(group) {
  const matchingAssets = await locateAsset(group.publicId, group.resourceType);
  const publicAssets = matchingAssets.filter(({ deliveryType }) => deliveryType !== 'authenticated');
  const authenticatedAssets = matchingAssets.filter(({ deliveryType }) => deliveryType === 'authenticated');

  if (publicAssets.length > 1 || (publicAssets.length > 0 && authenticatedAssets.length > 0)) {
    throw new Error('Conflicting Cloudinary delivery types exist for this asset.');
  }
  if (!publicAssets.length && !authenticatedAssets.length) {
    throw new Error('Cloudinary asset was not found.');
  }

  let cloudinaryResource = authenticatedAssets[0]?.resource;
  if (publicAssets.length) {
    const source = publicAssets[0];
    cloudinaryResource = await renameAsAuthenticated(
      group.publicId,
      group.resourceType,
      source.deliveryType
    );
  }

  const setFields = {
    'metadata.cloudinaryType': 'authenticated',
    'metadata.cloudinaryResourceType': group.resourceType
  };
  const format = cloudinaryResource?.format || group.format;
  if (format) setFields['metadata.cloudinaryFormat'] = format;

  const result = await Item.updateMany(
    { _id: { $in: group.items.map((item) => item._id) } },
    { $set: setFields }
  );
  return result.modifiedCount ?? result.nModified ?? 0;
}

async function main() {
  const flags = new Set(process.argv.slice(2));
  const allowedFlags = new Set([APPLY_FLAG, CONFIRM_FLAG]);
  if ([...flags].some((flag) => !allowedFlags.has(flag))) {
    throw new Error(`Only ${APPLY_FLAG} and ${CONFIRM_FLAG} are supported.`);
  }

  const apply = flags.has(APPLY_FLAG);
  if (flags.has(CONFIRM_FLAG) && !apply) {
    throw new Error(`${CONFIRM_FLAG} requires ${APPLY_FLAG}.`);
  }
  if (apply && !flags.has(CONFIRM_FLAG)) {
    throw new Error(`Applying changes requires both ${APPLY_FLAG} and ${CONFIRM_FLAG}.`);
  }
  if (!process.env.MONGO_URI) {
    throw new Error('Set MONGO_URI explicitly to the database you intend to inspect or migrate.');
  }
  if (!cloudinaryConfigured) {
    throw new Error('Cloudinary credentials are required to inspect or migrate assets.');
  }

  await mongoose.connect(process.env.MONGO_URI, { dbName: 'holder_db' });
  try {
    const items = await Item.find({
      'metadata.cloudinaryPublicId': { $exists: true, $ne: null }
    })
      .select('_id type metadata.cloudinaryPublicId metadata.cloudinaryResourceType metadata.cloudinaryFormat')
      .lean();
    const groups = groupLegacyItems(items);
    const totalReferences = groups.reduce((sum, group) => sum + group.items.length, 0);

    if (!apply) {
      console.log(`Dry run only: found ${groups.length} Cloudinary assets referenced by ${totalReferences} items.`);
      console.log('No Cloudinary or database changes were made.');
      console.log(`Review the target account, back up the database, then pass ${APPLY_FLAG} ${CONFIRM_FLAG} to apply.`);
      return;
    }

    let migratedAssets = 0;
    let updatedItems = 0;
    let failures = 0;
    for (const group of groups) {
      try {
        updatedItems += await makeAssetPrivate(group);
        migratedAssets += 1;
      } catch (error) {
        failures += 1;
        console.error(`Migration failed for one ${group.resourceType} asset group (HTTP ${getHttpStatus(error) || 'unknown'}).`);
      }
    }

    console.log(`Migration finished: ${migratedAssets}/${groups.length} asset groups secured; ${updatedItems} item records updated.`);
    if (failures) {
      throw new Error(`${failures} asset group(s) failed. Re-run after resolving the reported Cloudinary or database issue.`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Migration stopped: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { groupLegacyItems };
