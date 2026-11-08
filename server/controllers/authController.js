const User = require('../models/User');
const Folder = require('../models/Folder');
const Item = require('../models/Item');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const OAuthTicket = require('../models/OAuthTicket');
const { createAccessToken } = require('../config/security');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);

// Helper to seed default user folders and interactive starter items upon signup
async function seedUserDefaultFolders(userId) {
  try {
    const createdFolders = await Folder.insertMany([
      { userId, name: 'Brand Assets', description: 'Logos, colors, brand guidelines, key media links', icon: '', color: '#6366f1' },
      { userId, name: 'Private & Important', description: 'Vault for highly confidential notes, codes & credentials', icon: '', color: '#ec4899', isPrivate: true },
      { userId, name: 'YouTube & Learning', description: 'Saved YouTube videos, tutorials, tech lectures', icon: '', color: '#ef4444' },
      { userId, name: 'Web Bookmarks', description: 'Important websites, articles, docs', icon: '', color: '#10b981' }
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

// User Register
exports.register = async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!name || name.length > 100 || !email || email.length > 254 || !password) {
      return res.status(400).json({ success: false, message: 'Enter a valid name, email, and password.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({
        success: false,
        message: 'Use a password with at least 12 characters and no more than 72 UTF-8 bytes.'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      name,
      email,
      password: hashedPassword
    });

    await user.save();
    await seedUserDefaultFolders(user._id);

    const token = createAccessToken(user);

    res.set('Cache-Control', 'no-store');
    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar || '' }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }
    console.error('[Auth] Registration failed:', error.message);
    res.status(500).json({ success: false, message: 'Could not create your account. Please try again.' });
  }
};

// User Login
exports.login = async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password || email.length > 254 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    const isMatch = await bcrypt.compare(password, user?.password || DUMMY_PASSWORD_HASH);
    if (!user || !user.password || !isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = createAccessToken(user);

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar || '' }
    });
  } catch (error) {
    console.error('[Auth] Login failed:', error.message);
    res.status(500).json({ success: false, message: 'Could not sign you in. Please try again.' });
  }
};

// Google OAuth Callback Handler
exports.googleCallback = async (req, res) => {
  const clientUrl = (process.env.CLIENT_URL || 'https://doc-pied-five.vercel.app').trim().replace(/\/$/, '');
  try {
    const user = req.user;
    if (!user) {
      return res.redirect(`${clientUrl}/?error=no_user_found`);
    }

    const code = crypto.randomBytes(32).toString('base64url');
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    await OAuthTicket.create({
      codeHash,
      userId: user._id,
      expiresAt: new Date(Date.now() + 120 * 1000)
    });

    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    const redirect = () => res.redirect(`${clientUrl}/auth/callback?code=${code}`);
    if (req.session?.destroy) {
      req.session.destroy((error) => {
        if (error) {
          console.error('[Auth] Could not clear OAuth session:', error.message);
        }
        return redirect();
      });
    } else {
      redirect();
    }
  } catch (error) {
    console.error('[Auth] Google callback failed:', error.message);
    res.redirect(`${clientUrl}/?error=${encodeURIComponent(error.message || 'callback_error')}`);
  }
};

exports.exchangeGoogleCode = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const code = typeof body.code === 'string' ? body.code : '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(code)) {
    return res.status(400).json({ success: false, message: 'The sign-in code is invalid or expired.' });
  }

  try {
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const ticket = await OAuthTicket.findOneAndDelete({
      codeHash,
      expiresAt: { $gt: new Date() }
    });
    if (!ticket) {
      return res.status(401).json({ success: false, message: 'The sign-in code is invalid or expired.' });
    }

    const user = await User.findById(ticket.userId).select('_id name email avatar');
    if (!user) {
      return res.status(401).json({ success: false, message: 'The sign-in code is invalid or expired.' });
    }

    return res.json({
      success: true,
      token: createAccessToken(user),
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar || '' }
    });
  } catch (error) {
    console.error('[Auth] OAuth code exchange failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not complete sign-in. Please try again.' });
  }
};

// Get Current User Profile
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
