const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const Folder = require('../models/Folder');
const Item = require('../models/Item');

// Helper to seed default folders & starter items for new users
async function seedUserDefaultFolders(userId) {
  try {
    const createdFolders = await Folder.insertMany([
      { userId, name: 'Brand Assets', description: 'Logos, colors, brand guidelines, key media links', icon: '💼', color: '#6366f1' },
      { userId, name: 'Private & Important', description: 'Vault for highly confidential notes, codes & credentials', icon: '🔒', color: '#ec4899', isPrivate: true },
      { userId, name: 'YouTube & Learning', description: 'Saved YouTube videos, tutorials, tech lectures', icon: '🎥', color: '#ef4444' },
      { userId, name: 'Web Bookmarks', description: 'Important websites, articles, docs', icon: '🌐', color: '#10b981' }
    ]);

    const travelFolder = createdFolders.find(f => f.name === 'Private & Important') || createdFolders[0];
    const learningFolder = createdFolders.find(f => f.name === 'YouTube & Learning') || createdFolders[0];
    const webFolder = createdFolders.find(f => f.name === 'Web Bookmarks') || createdFolders[0];

    await Item.insertMany([
      {
        userId,
        title: 'Delta Flight Confirmation & In-Flight Wi-Fi (Screenshot)',
        type: 'image',
        folderId: travelFolder?._id || null,
        url: 'https://delta.com/manage-trip',
        previewUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1000&auto=format&fit=crop&q=80',
        content: 'Saved e-ticket for SFO -> JFK flight. Contains seat number, gate details, and in-flight Wi-Fi credentials.',
        ocrText: 'DELTA AIR LINES — E-TICKET CONFIRMATION\nBooking Ref: HLD-8921A\nPassenger: Alex Mercer\nFlight: DL 1492 | Seat: 14C (Window)\nDepart: San Francisco (SFO) 08:30 AM -> Arrive: New York (JFK) 04:55 PM\nWi-Fi Network: Delta-InFlight (Pass: FlyDelta2026)\nCustomer portal: https://delta.com/manage-trip\nBaggage check-in support: https://help.delta.com',
        ocrStatus: 'done',
        tags: ['flight', 'screenshot', 'ticket', 'wifi', 'travel'],
        metadata: {
          detectedUrls: ['https://delta.com/manage-trip', 'https://help.delta.com'],
          size: 420100
        },
        isFavorite: true,
        pinned: true
      },
      {
        userId,
        title: 'Steve Jobs 2005 Stanford Commencement Speech',
        type: 'youtube',
        folderId: learningFolder?._id || null,
        url: 'https://www.youtube.com/watch?v=UF8uR6Z6KLc',
        previewUrl: 'https://img.youtube.com/vi/UF8uR6Z6KLc/hqdefault.jpg',
        content: 'Iconic talk on connecting the dots, love and loss, and mortality. "Your time is limited, so don\'t waste it living someone else\'s life. Stay Hungry, Stay Foolish."',
        tags: ['inspiration', 'youtube', 'learning', 'career'],
        metadata: {
          youtubeId: 'UF8uR6Z6KLc',
          authorName: 'Stanford University'
        },
        isFavorite: true
      },
      {
        userId,
        title: 'Tailwind CSS — Rapidly build modern websites without leaving HTML',
        type: 'link',
        folderId: webFolder?._id || null,
        url: 'https://tailwindcss.com',
        previewUrl: 'https://tailwindcss.com/api/og',
        content: 'A utility-first CSS framework packed with classes that can be composed to build any design directly in your markup.',
        tags: ['design', 'css', 'frontend', 'developer'],
        metadata: {
          detectedUrls: ['https://tailwindcss.com']
        }
      }
    ]);
  } catch (err) {
    console.error('Error seeding user default folders & starter items:', err.message);
  }
}

module.exports = function configurePassport() {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn('⚠️ GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing in environment variables. Google OAuth will be disabled until set.');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: `${SERVER_URL}/api/auth/google/callback`
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value.toLowerCase() : '';
          const name = profile.displayName || (profile.name ? `${profile.name.givenName} ${profile.name.familyName}` : 'Google User');
          const avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : '';

          // 1. Check if user exists by googleId
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            if (avatar && user.avatar !== avatar) {
              user.avatar = avatar;
              await user.save();
            }
            return done(null, user);
          }

          // 2. Check if user exists by email
          if (email) {
            user = await User.findOne({ email });
            if (user) {
              user.googleId = profile.id;
              if (avatar && !user.avatar) user.avatar = avatar;
              await user.save();
              return done(null, user);
            }
          }

          // 3. Create new user
          user = new User({
            name,
            email: email || `${profile.id}@google.user`,
            googleId: profile.id,
            avatar
          });

          await user.save();
          await seedUserDefaultFolders(user._id);

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};
