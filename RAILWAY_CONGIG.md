# Railway Environment Variables Configuration

This guide shows you how to configure all XP values, formulas, voice settings, and role rewards through Railway environment variables to match your dashboard settings.

## 🚀 **Quick Setup in Railway**

1. Go to your Railway project dashboard
2. Click on your bot service  
3. Go to **"Variables"** tab
4. Add all the variables below

## 🎯 **Required Variables**

### Basic Configuration
```bash
DISCORD_TOKEN=your_discord_bot_token_here
NODE_ENV=production
```

## 📊 **XP Configuration (Matching Your Dashboard)**

### Message XP
```bash
# Random XP range for messages (matches your 25-35)
MESSAGE_XP_MIN=25
MESSAGE_XP_MAX=35
MESSAGE_COOLDOWN=60000  # 60 seconds (matches your 60s)
```

### Voice XP  
```bash
# Random XP range per minute in voice (matches your 45-55)
VOICE_XP_MIN=45
VOICE_XP_MAX=55
VOICE_COOLDOWN=180000   # 180 seconds (matches your 180s)

# Voice requirements (matches your settings)
VOICE_MIN_MEMBERS=2     # Minimum 2 members (matches your dashboard)
VOICE_ANTI_AFK=true     # Anti-AFK detection enabled
```

### Reaction XP
```bash
# Random XP range for reactions (matches your 25-35)
REACTION_XP_MIN=25
REACTION_XP_MAX=35
REACTION_COOLDOWN=300000  # 300 seconds (matches your 300s)
```

## 🧮 **Formula Configuration (New!)**

### Level Curve Settings
```bash
# Formula curve type (matches your "Exponential")
FORMULA_CURVE=exponential

# Multiplier (matches your 1.75)
FORMULA_MULTIPLIER=1.75

# Maximum level (matches your 50)
MAX_LEVEL=50

# Global XP multiplier
XP_MULTIPLIER=1.0
```

### Available Formula Types:
- `exponential` - Matches your dashboard (default)
- `linear` - Steady progression
- `logarithmic` - Fast early levels, slow later

## 🏆 **Level Role Rewards**

### Getting Role IDs
1. **Enable Developer Mode** in Discord:
   - User Settings → Advanced → Developer Mode ✅

2. **Get Role ID**:
   - Go to Server Settings → Roles
   - Right-click on any role → "Copy ID"

3. **Add to Railway**:
```bash
# Paste the copied Role IDs here
LEVEL_5_ROLE=123456789012345678
LEVEL_10_ROLE=123456789012345679
LEVEL_15_ROLE=123456789012345680
LEVEL_20_ROLE=123456789012345681
LEVEL_25_ROLE=123456789012345682
LEVEL_30_ROLE=123456789012345683
LEVEL_35_ROLE=123456789012345684
LEVEL_40_ROLE=123456789012345685
LEVEL_45_ROLE=123456789012345686
LEVEL_50_ROLE=123456789012345687
```

## 🎉 **Level Up Message Configuration (New!)**

### Customize Level Up Messages
```bash
# Enable/disable level up messages
LEVELUP_ENABLED=true

# Specific channel for level up messages (optional)
LEVELUP_CHANNEL=123456789012345688

# Custom level up message
LEVELUP_MESSAGE=Congratulations {user}! You've reached **Level {level}**!

# Show additional info
LEVELUP_SHOW_XP=true
LEVELUP_SHOW_PROGRESS=true  
LEVELUP_SHOW_ROLE=true
LEVELUP_PING_USER=false
```

### Level Up Message Variables:
- `{user}` - User mention or username
- `{level}` - New level achieved
- `{oldlevel}` - Previous level

## 🔧 **Configuration Examples**

### Your Current Dashboard Settings
```bash
# Matches your exact dashboard configuration
MESSAGE_XP_MIN=25
MESSAGE_XP_MAX=35
MESSAGE_COOLDOWN=60000

VOICE_XP_MIN=45
VOICE_XP_MAX=55
VOICE_COOLDOWN=180000
VOICE_MIN_MEMBERS=2
VOICE_ANTI_AFK=true

REACTION_XP_MIN=25
REACTION_XP_MAX=35
REACTION_COOLDOWN=300000

FORMULA_CURVE=exponential
FORMULA_MULTIPLIER=1.75
MAX_LEVEL=50
XP_MULTIPLIER=1.0
```

### Slow Progression Server
```bash
MESSAGE_XP_MIN=15
MESSAGE_XP_MAX=20
VOICE_XP_MIN=30
VOICE_XP_MAX=40
REACTION_XP_MIN=15
REACTION_XP_MAX=20
XP_MULTIPLIER=0.5
FORMULA_MULTIPLIER=0.8
```

### Fast Progression Server
```bash
MESSAGE_XP_MIN=40
MESSAGE_XP_MAX=60
VOICE_XP_MIN=80
VOICE_XP_MAX=100
REACTION_XP_MIN=40
REACTION_XP_MAX=60
XP_MULTIPLIER=2.0
FORMULA_MULTIPLIER=2.5
```

### Voice-Focused Community
```bash
MESSAGE_XP_MIN=20
MESSAGE_XP_MAX=25
VOICE_XP_MIN=60
VOICE_XP_MAX=80
REACTION_XP_MIN=15
REACTION_XP_MAX=20
VOICE_MIN_MEMBERS=3
```

### Anti-Spam Protection (Higher Cooldowns)
```bash
MESSAGE_COOLDOWN=120000  # 2 minutes
REACTION_COOLDOWN=600000 # 10 minutes
VOICE_COOLDOWN=300000    # 5 minutes
```

## 📈 **Advanced Voice Features**

### Voice Anti-AFK System
```bash
# Enable AFK detection (default: true)
VOICE_ANTI_AFK=true

# Minimum members required for XP (default: 2)
VOICE_MIN_MEMBERS=2

# Voice XP cooldown (prevents spam joining/leaving)
VOICE_COOLDOWN=180000  # 3 minutes
```

**How Anti-AFK Works:**
- Tracks user mute/deafen status
- Reduces XP if user is inactive for 10+ minutes
- Updates activity when user unmutes/undeafens

## 🎭 **Role Management Tips**

### Role Hierarchy
- Bot's role must be **above** all level reward roles
- Bot needs "Manage Roles" permission
- Users need appropriate permissions to use commands

### Creating Level Roles
**Suggested Role Names:**
```
Level 5:  🌱 Sprout
Level 10: 🌿 Growing  
Level 15: 🌳 Rooted
Level 20: 🎯 Focused
Level 25: ⭐ Rising Star
Level 30: 🔥 Veteran
Level 35: 💎 Elite
Level 40: 👑 Champion
Level 45: 🚀 Legendary
Level 50: 🌟 Mythic
```

###
