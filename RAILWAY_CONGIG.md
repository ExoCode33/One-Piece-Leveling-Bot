# Railway Environment Variables Configuration

This guide shows you how to configure all XP values and role rewards through Railway environment variables without redeploying.

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

### XP Configuration
```bash
# Message XP (random between min and max)
MESSAGE_XP_MIN=15
MESSAGE_XP_MAX=25

# Reaction XP (fixed amount)
REACTION_XP=5

# Voice XP (per minute in voice chat)
VOICE_XP_PER_MINUTE=1

# Global XP multiplier (1.0 = normal, 2.0 = double XP)
XP_MULTIPLIER=1.0
```

### Cooldown Configuration
```bash
# Message cooldown in milliseconds (60000 = 60 seconds)
MESSAGE_COOLDOWN=60000

# Reaction cooldown in milliseconds (30000 = 30 seconds)  
REACTION_COOLDOWN=30000
```

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

### Optional: Level Up Channel
```bash
# Channel where level up messages are sent (optional)
LEVEL_UP_CHANNEL=123456789012345688
```

## 🔧 **Configuration Examples**

### Slow Progression Server
```bash
MESSAGE_XP_MIN=5
MESSAGE_XP_MAX=10
REACTION_XP=2
VOICE_XP_PER_MINUTE=1
XP_MULTIPLIER=0.5
```

### Fast Progression Server
```bash
MESSAGE_XP_MIN=25
MESSAGE_XP_MAX=50
REACTION_XP=15
VOICE_XP_PER_MINUTE=5
XP_MULTIPLIER=2.0
```

### High Activity Server (Longer Cooldowns)
```bash
MESSAGE_COOLDOWN=120000  # 2 minutes
REACTION_COOLDOWN=60000  # 1 minute
```

### Gaming Community (Voice Focus)
```bash
MESSAGE_XP_MIN=10
MESSAGE_XP_MAX=15
REACTION_XP=3
VOICE_XP_PER_MINUTE=3    # Higher voice XP
XP_MULTIPLIER=1.0
```

## 📊 **XP Calculation Examples**

### With Default Settings:
- **Message**: 15-25 XP every 60 seconds
- **Reaction**: 5 XP every 30 seconds  
- **Voice**: 1 XP per minute (with 2+ people)
- **Multiplier**: 1.0x (no change)

### With 2x Multiplier:
- **Message**: 30-50 XP every 60 seconds
- **Reaction**: 10 XP every 30 seconds
- **Voice**: 2 XP per minute

## 🔄 **Updating Configuration**

### Method 1: Railway Dashboard (Recommended)
1. Go to Railway dashboard
2. Select your bot service
3. Click "Variables" tab
4. Modify any values
5. Bot automatically restarts with new settings

### Method 2: Using /reload Command
1. Update variables in Railway dashboard
2. Use `/reload` command in Discord (Admin only)
3. Bot reloads configuration without restart

## 🎭 **Role Management Tips**

###
