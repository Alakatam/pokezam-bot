# Collector Status Redesign - Pagination System

## Old Design Problems:
- ❌ Massive wall of text (200+ lines)
- ❌ All departments shown at once
- ❌ Overwhelming for users
- ❌ Hard to find specific info

## New Design Solution:
- ✅ Clean overview embed (20-30 lines)
- ✅ Pagination buttons for each department
- ✅ Detailed view per department only when needed
- ✅ Easy navigation with buttons

---

## Overview Embed Structure:

```yaml
#════════════════════════════════════════
# 🏪 COLLECTOR'S SHOP OVERVIEW
#════════════════════════════════════════

👤 TRAINER: Username
💰 GOLD: 50,000g

🏪 SHOP LEVEL: 5
   Upgrade Cost: 7,594g
   Departments: 3/5

📊 LIFETIME EARNINGS:
   Coins: 125,000g
   Cards: 450

💼 READY TO COLLECT:
   💰 Coins: 1,200g
   🃏 Cards: 5
   🎁 Packs: 1

💡 Click buttons below to view department details!
```

---

## Department Detail Buttons:

Row 1: Active Departments
- [💰 Trade Counter] [📦 Bulk Bin] [🎁 Pack Storage]

Row 2: Locked/Available
- [🔓 Glass Case] [🔒 Expert Grader]

---

## Department Detail Embed (Example: Trade Counter):

```yaml
#════════════════════════════════════════
# 💰 TRADE COUNTER - LEVEL 3
#════════════════════════════════════════

📝 DESCRIPTION:
   Generates coins passively

🟢 STATUS: Open (2.5h left)
📈 BUSINESS: Busy Day (+15%)
⏰ OPERATING HOURS: 5.6h/day

💰 GENERATION:
   Rate: 156 coins/hour
   Storage: 720/1,953 coins
   Time to Fill: 7.9 hours

📈 STATS:
   Current Level: 3
   Upgrade Cost: 845g
   Max Level: 5

💡 Provides passive income during operating hours
```

---

## Button Handlers Needed:

###index.js button handlers:
1. `collector_dept_{deptId}_{userId}` - View specific department
2. `collector_overview_{userId}` - Return to overview
3. `collector_close_{userId}` - Close embed

### Cache Structure:
```javascript
collectorStatusCache.set(userId, {
    shop,
    departments,
    timestamp: Date.now()
});
```

---

## Implementation Plan:

### Step 1: Create Overview Embed Function
```javascript
async buildOverviewEmbed(interaction, user, shop, departments, collectorShopManager)
```

### Step 2: Create Department Buttons
```javascript
buildDepartmentButtons(departments, collectorShopManager, userId)
```

### Step 3: Create Department Detail Embed
```javascript
async buildDepartmentEmbed(interaction, deptId, shop, departments, collectorShopManager)
```

### Step 4: Add Button Handlers in index.js
- Handle `collector_dept_` buttons
- Handle `collector_overview_` button
- Handle `collector_close_` button

---

## Benefits:

1. **Cleaner UI**: Users see only what they need
2. **Easier Navigation**: Button-based system
3. **Faster Loading**: Less data processed at once
4. **Better UX**: Progressive disclosure pattern
5. **Mobile Friendly**: Shorter embeds work better on mobile

---

## Example User Flow:

1. `/collector` → See clean overview
2. Click [📦 Bulk Bin] → See Bulk Bin details
3. Click [◀ Back to Overview] → Return to main view
4. Click [🎁 Pack Storage] → See Pack Storage details
5. Click [Close] → Dismiss embed

