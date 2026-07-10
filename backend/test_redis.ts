import { redis } from './utils/redisInstance';

const randomSuffix = Math.random().toString(36).substring(7);
const testKey = `leader:test-${randomSuffix}`;
const testValue = `test-instance-${randomSuffix}`;
const wrongValue = 'wrong-instance';

async function testRedisLease() {
    try {
        // Connect if not already connected
        if (!redis.isOpen) {
            await redis.connect();
        }
        
        console.log(`Using throwaway key: ${testKey}`);
        
        // Test 1: SET NX EX 60 should return 'OK'
        const set1 = await redis.set(testKey, testValue, { NX: true, EX: 60 });
        console.log('First SET NX EX 60:', set1);
        
        // Test 2: Second SET NX should return null
        const set2 = await redis.set(testKey, 'other-value', { NX: true, EX: 60 });
        console.log('Second SET NX:', set2);
        
        // Test 3: Lua extend script with correct value should return 1
        const extendScript = `
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("EXPIRE", KEYS[1], tonumber(ARGV[2]))
            else
                return 0
            end
        `;
        const extend1 = await redis.eval(extendScript, {
            keys: [testKey],
            arguments: [testValue, '60']
        });
        console.log('Lua extend with correct value:', extend1);
        
        // Test 4: Lua extend script with wrong value should return 0
        const extend2 = await redis.eval(extendScript, {
            keys: [testKey],
            arguments: [wrongValue, '60']
        });
        console.log('Lua extend with wrong value:', extend2);
        
        // Test 5: Lua release with correct value should return 1
        const releaseScript = `
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("DEL", KEYS[1])
            else
                return 0
            end
        `;
        const release1 = await redis.eval(releaseScript, {
            keys: [testKey],
            arguments: [testValue]
        });
        console.log('Lua release with correct value:', release1);
        
        // Cleanup: DEL the key (in case release didn't work)
        await redis.del(testKey);
        console.log('Cleanup: key deleted');
        
        // Check results
        const pass = set1 === 'OK' && set2 === null && extend1 === 1 && extend2 === 0 && release1 === 1;
        console.log('All tests pass:', pass);
        
        await redis.quit();
        process.exit(pass ? 0 : 1);
    } catch (err) {
        console.error('Error:', err);
        try {
            await redis.quit();
        } catch {}
        process.exit(1);
    }
}

testRedisLease();
