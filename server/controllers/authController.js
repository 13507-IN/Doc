const User = require('../models/User');
const Folder = require('../models/Folder');
const Item = require('../models/Item');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'holder_jwt_secret_key_13507';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

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
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword
    });

    await user.save();
    await seedUserDefaultFolders(user._id);

    const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar || '' }
    });
  } catch (error) {
    console.error('[Auth] Registration failed:', error.message);
    res.status(500).json({ success: false, message: 'Could not create your account. Please try again.' });
  }
};

// User Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.password) {
      return res.status(400).json({ success: false, message: 'This account was created with Google Sign-In. Please click "Continue with Google".' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });

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
  try {
    const user = req.user;
    if (!user) {
      return res.redirect(`${CLIENT_URL}?error=oauth_failed`);
    }

    const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
    const userParam = encodeURIComponent(JSON.stringify({ id: user._id, name: user.name, email: user.email, avatar: user.avatar || '' }));

    res.redirect(`${CLIENT_URL}/auth/callback?token=${token}&user=${userParam}`);
  } catch (error) {
    res.redirect(`${CLIENT_URL}?error=${encodeURIComponent(error.message)}`);
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
