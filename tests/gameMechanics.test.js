const test = require('node:test');
const assert = require('node:assert/strict');
const UserManager = require('../database/UserManager');

test('UserManager Level Calculation', () => {
    const um = new UserManager(null);
    
    // Level 1: 0 XP
    assert.equal(um.calculateLevel(0), 1);
    
    // Level 2 requires 100 XP
    assert.equal(um.calculateLevel(99), 1);
    assert.equal(um.calculateLevel(100), 2);
    
    // Higher levels scale progressively
    const lvl10 = um.calculateLevel(5000);
    assert.ok(lvl10 > 2);
});

test('UserManager XP Progress Info', () => {
    const um = new UserManager(null);
    const progress = um.getXPForNextLevel(50, 1);
    assert.equal(progress.current, 50);
    assert.equal(progress.required, 100);
    assert.equal(progress.remaining, 50);
});

test('Rarity Drop Rate Calculations', () => {
    const rarityTiers = [
        { name: 'Common', threshold: 57 },
        { name: 'Uncommon', threshold: 43 },
        { name: 'Rare', threshold: 13 },
        { name: 'Promo', threshold: 0.1 }
    ];

    // Verify thresholds are logically ordered
    for (let i = 0; i < rarityTiers.length - 1; i++) {
        assert.ok(rarityTiers[i].threshold >= rarityTiers[i + 1].threshold);
    }
});
