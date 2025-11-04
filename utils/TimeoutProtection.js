/**
 * Database Operation Timeout Protection
 * Wraps database operations with timeout protection to prevent Discord interaction timeouts
 */

class TimeoutProtection {
    constructor(defaultTimeout = 8000) { // 8 seconds default (Discord allows 15s total)
        this.defaultTimeout = defaultTimeout;
    }

    // Wrap database operations with timeout protection
    async withTimeout(operation, timeout = this.defaultTimeout, fallback = null) {
        return new Promise(async (resolve, reject) => {
            let timeoutId;
            let completed = false;

            // Set up timeout
            timeoutId = setTimeout(() => {
                if (!completed) {
                    completed = true;
                    console.warn(`⚠️ Database operation timed out after ${timeout}ms`);
                    if (fallback !== null) {
                        resolve(fallback);
                    } else {
                        reject(new Error(`Database operation timeout after ${timeout}ms`));
                    }
                }
            }, timeout);

            try {
                // Execute the operation
                const result = await operation();
                
                if (!completed) {
                    completed = true;
                    clearTimeout(timeoutId);
                    resolve(result);
                }
            } catch (error) {
                if (!completed) {
                    completed = true;
                    clearTimeout(timeoutId);
                    reject(error);
                }
            }
        });
    }

    // Specific wrapper for user operations
    async safeUserOperation(operation, fallback = null) {
        return this.withTimeout(operation, 5000, fallback);
    }

    // Specific wrapper for card operations
    async safeCardOperation(operation, fallback = null) {
        return this.withTimeout(operation, 7000, fallback);
    }

    // Specific wrapper for quest operations
    async safeQuestOperation(operation, fallback = []) {
        return this.withTimeout(operation, 3000, fallback);
    }

    // Batch operation with individual timeouts
    async safeBatchOperation(operations, individualTimeout = 2000) {
        const results = [];
        
        for (let i = 0; i < operations.length; i++) {
            try {
                const result = await this.withTimeout(operations[i], individualTimeout, null);
                results.push({ success: true, result, index: i });
            } catch (error) {
                console.error(`Batch operation ${i} failed:`, error.message);
                results.push({ success: false, error: error.message, index: i });
            }
        }
        
        return results;
    }
}

module.exports = TimeoutProtection;