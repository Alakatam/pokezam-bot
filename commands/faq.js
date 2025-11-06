const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('faq')
        .setDescription('Frequently Asked Questions about Pokézam TCG Bot')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Choose an FAQ category to view')
                .setRequired(false)
                .addChoices(
                    { name: '🎯 Getting Started', value: 'getting-started' },
                    { name: '🎴 Cards & Drawing', value: 'cards' },
                    { name: '🎯 Quests & XP', value: 'quests' },
                    { name: '🛒 Shop & Items', value: 'shop' },
                    { name: '📊 Levels & Progression', value: 'progression' },
                    { name: '🔧 Commands & Features', value: 'commands' }
                )
        ),
    
    async execute(interaction) {
        try {
            await interaction.deferReply();
            
            const category = interaction.options.getString('category');
            
            if (!category) {
                // Show overview with navigation buttons
                await this.showFAQOverview(interaction);
            } else {
                // Show specific category
                await this.showFAQCategory(interaction, category);
            }

        } catch (error) {
            console.error('Error in FAQ command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while loading the FAQ. Please try again!',
                ephemeral: true
            });
        }
    },

    async showFAQOverview(interaction) {
        const yamlContent = `\`\`\`yaml
#═══════════════════════════════════════════════════
# 📋 POKÉZAM TCG BOT - FREQUENTLY ASKED QUESTIONS
#═══════════════════════════════════════════════════

bot version            : "v2.0 - Enhanced Edition"
total commands         : "18 slash commands available"
database size          : "101 TCG sets, 10,000+ cards"
last updated           : "November 2025"

#───────────────────────────────────────────────────
# 🎯 QUICK START GUIDE
#───────────────────────────────────────────────────

new user steps:
  1. type "/start"      : "Get starter package & unlock features"
  2. type "/zam"        : "Draw your first cards"
  3. type "/quest"      : "Check daily quests for XP/Gold"
  4. type "/profile"    : "View your progress"
  5. type "/shop"       : "Buy powerful boost items"

essential commands     : "/help - See all commands"

#───────────────────────────────────────────────────
# 📚 FAQ CATEGORIES AVAILABLE
#───────────────────────────────────────────────────

🎯 getting started:
  topics               : "First steps, /start command, basics"
  
🎴 cards & drawing:
  topics               : "How to draw, rarities, collections"
  
🎯 quests & xp:
  topics               : "Quest system, XP earning, levels"
  
🛒 shop & items:
  topics               : "Item store, boosts, prices, effects"
  
📊 levels & progression:
  topics               : "Leveling up, unlocks, requirements"
  
🔧 commands & features:
  topics               : "All commands, advanced features"

#───────────────────────────────────────────────────
# ❓ NEED IMMEDIATE HELP?
#───────────────────────────────────────────────────

quick answers:
  stuck question       : "Use /start to begin your journey"
  no cards available   : "Level up to unlock more sets"
  quest not working    : "Complete /start first"
  shop access denied   : "Begin adventure with /start"

support                : "Use buttons below for detailed help!"

#═══════════════════════════════════════════════════
\`\`\``;

        // Create navigation buttons
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('faq_getting-started')
                    .setLabel('🎯 Getting Started')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('faq_cards')
                    .setLabel('🎴 Cards & Drawing')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('faq_quests')
                    .setLabel('🎯 Quests & XP')
                    .setStyle(ButtonStyle.Primary)
            );

        const buttons2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('faq_shop')
                    .setLabel('🛒 Shop & Items')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('faq_progression')
                    .setLabel('📊 Levels & Progression')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('faq_commands')
                    .setLabel('🔧 Commands & Features')
                    .setStyle(ButtonStyle.Primary)
            );

        const embed = new EmbedBuilder()
            .setTitle('📋 Pokézam TCG Bot - FAQ Overview')
            .setDescription(yamlContent)
            .setColor(0x00ff00)
            .setTimestamp()
            .setFooter({ 
                text: `${interaction.user.username}, select a category for detailed help!`, 
                iconURL: interaction.user.displayAvatarURL() 
            });

        await interaction.editReply({
            embeds: [embed],
            components: [buttons, buttons2]
        });
    },

    async showFAQCategory(interaction, category) {
        const faqData = this.getFAQData(category);
        
        const embed = new EmbedBuilder()
            .setTitle(faqData.title)
            .setDescription(faqData.content)
            .setColor(faqData.color)
            .setTimestamp()
            .setFooter({ 
                text: `${interaction.user.username} - Use /faq for overview`, 
                iconURL: interaction.user.displayAvatarURL() 
            });

        // Back button
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('faq_overview')
                    .setLabel('← Back to Overview')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [backButton]
        });
    },

    getFAQData(category) {
        const faqCategories = {
            'getting-started': {
                title: '🎯 Getting Started with Pokézam',
                color: 0x00ff00,
                content: `\`\`\`yaml
#═══════════════════════════════════════════════════
# 🎯 GETTING STARTED - YOUR POKÉZAM JOURNEY
#═══════════════════════════════════════════════════

❓ "How do I start playing?"
answer                 : "Type '/start' to begin your adventure!"

starter package includes:
  welcome charm        : "125 uses - Boosts everything"
  starting gold        : "500 coins"
  quest access         : "Daily/Weekly/Monthly challenges"
  card drawing         : "Unlocks /zam command"

❓ "I'm new, what should I do first?"
step by step:
  1. "/start"          : "Get your starter package"
  2. "/zam"            : "Draw your first cards"
  3. "/quest"          : "Check available quests"
  4. "/profile"        : "See your progress"

❓ "Why can't I use /zam or other commands?"
common issue           : "You need to use /start first!"
all features locked    : "Complete onboarding process"
solution               : "Type '/start' to unlock everything"

❓ "What's the Welcome Charm?"
description            : "Special starter item with 125 uses"
effects                : "Boosts gold, XP, and card luck"
duration               : "Permanent until uses run out"
value                  : "Worth 300,000+ gold if bought!"

❓ "Is the bot free to use?"
answer                 : "100% free! No premium features"
all content            : "Accessible to everyone equally"

#═══════════════════════════════════════════════════
\`\`\``
            },

            'cards': {
                title: '🎴 Cards & Drawing System',
                color: 0x9932cc,
                content: `\`\`\`yaml
#═══════════════════════════════════════════════════
# 🎴 CARDS & DRAWING - COLLECTION BUILDING
#═══════════════════════════════════════════════════

❓ "How do I draw cards?"
command                : "/zam (5 second cooldown)"
requirement            : "Must complete /start first"
cost                   : "Free! No gold required"

❓ "What is Global Spawn?"
description            : "Ultra-rare cards get posted to global channel!"
requirements:
  rarity               : "Must be actual holographic rarity"
  variants             : "Reverse holo, first edition, promo variants"
  showcase             : "Shared with entire server automatically"
visibility             : "Everyone sees your amazing pulls!"

❓ "What cards can I get?"
total sets             : "101 TCG sets available"
total cards            : "10,000+ unique cards"
current sets loaded:
  base set (base1)     : "Original 102 cards - Level 1+"
  jungle (base2)       : "64 cards - Level 10+"
  fossil (base3)       : "62 cards - Level 10+"
more sets coming       : "Future expansions in development"

❓ "What are the rarities?"
card rarities:
  basic rarities:
    common             : "●○○○○○ - Most frequent"
    uncommon           : "●●○○○○ - Moderate frequency"
    rare               : "●●●○○○ - Less common"
    rare holo          : "●●●●○○ - Very rare"
  
  classic special rarities:
    rare prime         : "●●●●●○ - Prime Pokémon (HGSS era)"
    rare legend        : "●●●●●○ - LEGEND Pokémon (HGSS era)"
    rare break         : "●●●●●○ - BREAK evolution (XY era)"
    rare ace           : "●●●●●○ - ACE SPEC trainers (BW era)"
  
  modern special rarities:
    rare ultra         : "●●●●●○ - Ultra rare cards"
    rare secret        : "●●●●●○ - Secret rare numbering"
    rare rainbow       : "●●●●●○ - Rainbow foil pattern"
    amazing rare       : "●●●●●○ - Amazing rare (SWSH era)"
    radiant rare       : "●●●●●○ - Radiant Pokémon (SWSH era)"
  
  v series rarities:
    rare holo v        : "●●●●●○ - Pokémon V cards"
    rare holo vmax     : "●●●●●● - Pokémon VMAX cards"
    rare holo vstar    : "●●●●●● - Pokémon VSTAR cards"
  
  sv series rarities:
    double rare        : "●●●●●○ - Standard ex cards (SV era)"
    illustration rare  : "●●●●●● - Special artwork variants"
    special illustration rare : "●●●●●● - Ultra special artwork"
    ace spec rare      : "●●●●●● - Modern ACE SPEC cards"
    hyper rare         : "●●●●●● - Highest rarity tier"

❓ "How do variants work?"
variant system         : "Currently in development"
note                   : "Master Set variant tracking temporarily disabled"
future features        : "Variant collection coming in future update"

❓ "Can I see my collection?"
commands available:
  "/binder"            : "View your card binder"
  "/carddex-reg"       : "Regional Pokédex progress"
note                   : "Master collection commands coming soon!"

❓ "What's the gold system?"
earning gold:
  card draws           : "10-25 gold per card"
  quest completion     : "150-50,000 gold rewards"
  level bonuses        : "Bonus gold when leveling up"

spending gold:
  shop items           : "50,000-500,000+ gold"
  boosts               : "Gold/Luck/Special effects"

#═══════════════════════════════════════════════════
\`\`\``
            },

            'quests': {
                title: '🎯 Quests & XP System',
                color: 0xffd700,
                content: `\`\`\`yaml
#═══════════════════════════════════════════════════
# 🎯 QUESTS & XP - PROGRESSION SYSTEM
#═══════════════════════════════════════════════════

❓ "How do quests work?"
access command         : "/quest (requires /start)"
reset times            : "20:00 ET daily/weekly/monthly"
automatic assignment   : "No manual selection needed"

quest types:
  daily quests:
    card hunter        : "Draw cards - 10 XP + 150 Gold"
    collection builder : "Collection goals - 25 XP + 400 Gold"
    daily dedication   : "Complete tasks - 50 XP + 800 Gold"
    
  weekly challenges:
    collector          : "Weekly goals - 75 XP + 1,000 Gold"
    explorer           : "Exploration tasks - 150 XP + 2,500 Gold"
    master             : "Mastery challenges - 300 XP + 5,000 Gold"
    
  monthly legends:
    champion           : "Championship level - 500 XP + 10,000 Gold"
    legend             : "Legendary status - 1,000 XP + 25,000 Gold"
    pokemon master     : "Ultimate goal - 2,000 XP + 50,000 Gold"

❓ "What's the new XP system?"
progression formula    : "100 base XP + 50 per level"
level examples:
  level 5              : "700 total XP needed"
  level 10             : "2,700 total XP needed"
  level 20             : "10,450 total XP needed"
  level 30             : "23,200 total XP needed"

❓ "Why is leveling slower now?"
balance update         : "November 2025 rebalancing"
old system problem     : "Too easy (level 37 casually)"
new system benefit     : "Every level feels earned!"

❓ "How to complete quests faster?"
card drawing quests    : "Use /zam repeatedly"
collection quests      : "Draw from different sets"
dedication quests      : "Daily participation"

#═══════════════════════════════════════════════════
\`\`\``
            },

            'shop': {
                title: '🛒 Shop & Items System',
                color: 0x00ff00,
                content: `\`\`\`yaml
#═══════════════════════════════════════════════════
# 🛒 SHOP & ITEMS - BOOST YOUR PROGRESS
#═══════════════════════════════════════════════════

❓ "How do I access the shop?"
command                : "/shop (requires /start)"
navigation             : "4 pages with arrow buttons"
payment method         : "Gold coins earned in-game"

shop categories:
  page 1 - gold boosts:
    amulet coin        : "50,000G - 2x gold for 30min"
    golden horseshoe   : "85,000G - 3x gold for 30min"
    fortune charm      : "150,000G - 5x gold for 15min"
    
  page 2 - luck boosts:
    collectors charm   : "75,000G - 2x rare chance, 1hr"
    shiny charm        : "125,000G - 3x rare chance, 45min"
    master ball        : "200,000G - 5x rare chance, 30min"
    
  page 3 - multi boosts:
    lucky penny        : "100,000G - 1.5x gold+luck, 45min"
    rainbow charm      : "175,000G - 2x gold+luck, 30min"
    
  page 4 - special items:
    treasure chest     : "300,000G - Instant rewards"
    mystery box        : "500,000G - Unknown surprises"

❓ "Why are prices so high?"
design philosophy      : "Balanced for hardcore grinders"
earning potential      : "Daily quests = 1,350 gold"
grinding capability    : "Active players earn 50,000+ daily"
value proposition      : "Significant time investment required"

❓ "How do I use items?"
purchase process       : "Buy from /shop"
inventory check        : "/inventory to see owned items"
activation             : "/use <item_name>"
active effects         : "/active-boosts to see running effects"

❓ "What's the Welcome Charm?"
starter item           : "Included in /start package"
uses remaining         : "125 charges"
category               : "Multi-boost (gold + luck + XP)"
equivalent value       : "300,000+ gold if purchased"

❓ "Do effects stack?"
same type effects      : "No - newer replaces older"
different categories   : "Yes - can have gold + luck together"
welcome charm          : "Stacks with everything!"

#═══════════════════════════════════════════════════
\`\`\``
            },

            'progression': {
                title: '📊 Levels & Progression System',
                color: 0x0099ff,
                content: `\`\`\`yaml
#═══════════════════════════════════════════════════
# 📊 LEVELS & PROGRESSION - ADVANCE YOUR TRAINER
#═══════════════════════════════════════════════════

❓ "How do I level up?"
xp sources:
  daily quests         : "10-50 XP each"
  weekly quests        : "75-300 XP each"
  monthly quests       : "500-2,000 XP each"
  special events       : "Bonus XP opportunities"

❓ "What do levels unlock?"
card set unlocks:
  level 1-9            : "Base Set (Classic 102 cards)"
  level 10-24          : "Jungle Set (64 new cards)"
  level 25+            : "Fossil Set (62 more cards)"
  future levels        : "More sets coming soon!"

❓ "How long does it take to level up?"
progression examples:
  level 1 to 5         : "~1 week of daily quests"
  level 1 to 10        : "~3-4 weeks consistent play"
  level 1 to 20        : "~3 months dedicated play"
  level 1 to 30        : "~6+ months serious grinding"

❓ "What's my current progress?"
check commands:
  "/profile"           : "See level, XP, and stats"
  "/profile @user"     : "Check another user's progress"
  xp display           : "Shows current/required XP"

❓ "Can I see level requirements?"
xp formula             : "Level N needs: 100 + (N-2) × 50 XP"
level examples:
  level 2              : "100 XP total"
  level 5              : "700 XP total"  
  level 10             : "2,700 XP total"
  level 15             : "5,950 XP total"
  level 20             : "10,450 XP total"

❓ "Why did leveling get harder?"
november 2025 update   : "Rebalanced for better experience"
old problem            : "Level 37 with casual play"
new experience         : "Every level feels meaningful"
benefit                : "True sense of achievement!"

❓ "Any tips for faster leveling?"
efficient strategies:
  complete all dailies : "85 XP + 1,350 gold per day"
  weekly completion    : "525 XP + 8,500 gold per week"
  monthly dedication   : "3,500 XP + 85,000 gold per month"
  consistency bonus    : "Regular play = better results"

#═══════════════════════════════════════════════════
\`\`\``
            },

            'commands': {
                title: '🔧 Commands & Features Guide',
                color: 0xff6b6b,
                content: `\`\`\`yaml
#═══════════════════════════════════════════════════
# 🔧 COMMANDS & FEATURES - COMPLETE REFERENCE
#═══════════════════════════════════════════════════

❓ "What commands are available?"
total commands         : "15 active slash commands"

essential commands:
  "/start"             : "Begin your adventure (required first!)"
  "/help"              : "Command list and descriptions"
  "/faq"               : "This FAQ system"

card & collection:
  "/zam"               : "Draw cards (5s cooldown)"
  "/binder"            : "View your card collection"
  "/carddex-reg"       : "Regional Pokédex progress"

progression & stats:
  "/profile"           : "Your level, XP, and stats"
  "/quest"             : "Daily/Weekly/Monthly quests"
  "/daily"             : "Daily rewards and streaks"

economy & items:
  "/shop"              : "Item store (4 pages)"
  "/inventory"         : "Your items and effects"
  "/use"               : "Activate owned items"
  "/active-boosts"     : "See running effects"

special features:
  "/sync"              : "Database synchronization"
  "/premium-pack"      : "Premium pack opening"
  "/vintage-pack"      : "Vintage pack opening"

coming soon:
  master set system    : "Variant tracking & collection"
  achievements         : "Challenge completion rewards"

❓ "What are pack commands?"
pack types:
  master pack          : "Guaranteed rare+ cards"
  premium pack         : "Higher chance of holos"
  vintage pack         : "Classic set focus"

❓ "Are there admin commands?"
admin access           : "Bot owner/server admins only"
admin features:
  "/admin reset-trainer" : "Complete account reset"
  "/admin toggle-cooldown" : "Bypass draw cooldowns"
  "/admin stats"       : "Bot usage statistics"

❓ "What's the cooldown system?"
draw cooldown          : "5 seconds between /zam uses"
bypass option          : "Admins can disable for testing"
reason                 : "Prevents spam and server load"

❓ "Can I check other users?"
user-specific commands:
  "/profile @user"     : "See another user's stats"
  "/inventory @user"   : "View someone's items"
  "/binder @user"      : "Check their card collection"

#═══════════════════════════════════════════════════
\`\`\``
            }
        };

        return faqCategories[category] || faqCategories['getting-started'];
    }
};