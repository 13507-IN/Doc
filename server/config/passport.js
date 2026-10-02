const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const Folder = require('../models/Folder');

// Helper to seed default folders for new users
async function seedUserDefaultFolders(userId) {
  try {
    await Folder.insertMany([
      { userId, name: 'Brand Assets', description: 'Logos, colors, brand guidelines, key media links', icon: '💼', color: '#6366f1' },
      { userId, name: 'Private & Important', description: 'Vault for highly confidential notes, codes & credentials', icon: '🔒', color: '#ec4899', isPrivate: true },
      { userId, name: 'YouTube & Learning', description: 'Saved YouTube videos, tutorials, tech lectures', icon: '🎥', color: '#ef4444' },
      { userId, name: 'Web Bookmarks', description: 'Important websites, articles, docs', icon: '🌐', color: '#10b981' }
    ]);
  } catch (err) {
    console.error('Error seeding user default folders:', err.message);
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
