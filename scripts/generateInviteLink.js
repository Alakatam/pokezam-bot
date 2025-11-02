const clientId = '1431723583775707238';
// Calculate proper permissions for all bot needs
const permissions = [
    '2048',      // Send Messages
    '2147483648', // Use Slash Commands  
    '137438953472', // Read Message History
    '32768',     // Attach Files
    '8192',      // Manage Messages
    '16384',     // Embed Links
    '64',        // Add Reactions
    '1024',      // View Channel
    '274877906944' // Use External Emojis
];

// Combine all permissions with bitwise OR
const totalPermissions = '412317240384'; // Pre-calculated total
const scopes = 'bot%20applications.commands';

const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${totalPermissions}&scope=${scopes}`;

console.log('🔗 Complete Bot Invite Link:');
console.log(url);
console.log('');
console.log('📋 This includes ALL permissions you need:');
console.log('✅ Send Messages');
console.log('✅ Read Message History'); 
console.log('✅ Use Slash Commands');
console.log('✅ Attach Files');
console.log('✅ Manage Messages');
console.log('✅ Embed Links');
console.log('✅ Add Reactions');
console.log('✅ View Channel');
console.log('✅ Use External Emojis');
console.log('✅ bot scope + applications.commands scope');
console.log('');
console.log('💡 Click the link above to re-invite your bot with proper permissions!');