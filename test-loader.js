// Test script to verify ProductionTCGLoader works
const { ProductionTCGLoader } = require('./scripts/loadProductionBaseSets');

console.log('🔍 Testing ProductionTCGLoader...');

try {
    const loader = new ProductionTCGLoader();
    console.log('✅ ProductionTCGLoader instance created');
    
    // Check if loadBaseSetsOnly method exists
    if (typeof loader.loadBaseSetsOnly === 'function') {
        console.log('✅ loadBaseSetsOnly method exists');
        console.log('🎯 Method signature:', loader.loadBaseSetsOnly.toString().substring(0, 100) + '...');
    } else {
        console.error('❌ loadBaseSetsOnly method does not exist');
        console.log('📋 Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(loader)));
    }
} catch (error) {
    console.error('❌ Error testing ProductionTCGLoader:', error.message);
    console.error('📋 Stack:', error.stack);
}