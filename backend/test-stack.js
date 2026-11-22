const pool = require('./src/db');
const stackService = require('./src/services/stack.service');
const userRepository = require('./src/repositories/user.repository');
const bcrypt = require('bcrypt');

async function runStackTests() {
  console.log('\n===========================================');
  console.log('STARTING TECHNOLOGY STACK TESTS');
  console.log('===========================================\n');

  const user1Email = `stack_user1_${Date.now()}@example.com`;
  const user2Email = `stack_user2_${Date.now()}@example.com`;
  const passwordHash = await bcrypt.hash('TestPass123!#', 10);

  let user1Id, user2Id, createdItemId;

  try {
    // Setup test users
    const u1 = await userRepository.createUser({ email: user1Email, passwordHash, isVerified: true });
    const u2 = await userRepository.createUser({ email: user2Email, passwordHash, isVerified: true });
    user1Id = u1.id;
    user2Id = u2.id;
    console.log(`Created test User 1 (#${user1Id}) and User 2 (#${user2Id})`);

    // 1. Validation tests
    console.log('\n[TEST 1] Validation: Missing product name (should fail 400)...');
    try {
      await stackService.createStackItem(user1Id, {
        product_name: '',
        installed_version: '1.0.0',
      });
      throw new Error('Test 1 failed: Missing product name was accepted');
    } catch (err) {
      console.log('✓ Rejected missing product name correctly:', err.message);
    }

    console.log('\n[TEST 2] Validation: Missing installed version (should fail 400)...');
    try {
      await stackService.createStackItem(user1Id, {
        product_name: 'Nginx',
        installed_version: '   ',
      });
      throw new Error('Test 2 failed: Empty version was accepted');
    } catch (err) {
      console.log('✓ Rejected empty version correctly:', err.message);
    }

    // 2. Successful creation
    console.log('\n[TEST 3] Create valid stack items for User 1...');
    const item1 = await stackService.createStackItem(user1Id, {
      vendor: 'Apache Software Foundation',
      product_name: 'HTTP Server',
      installed_version: '2.4.52',
      notes: 'Main edge reverse proxy',
    });
    createdItemId = item1.id;
    console.log('✓ Created item ID:', item1.id, '-', item1.product_name, item1.installed_version);

    const item2 = await stackService.createStackItem(user1Id, {
      product_name: 'PostgreSQL',
      installed_version: '16.2',
    });
    console.log('✓ Created item ID without optional fields:', item2.id, '-', item2.product_name);

    // 3. List items for User 1
    console.log('\n[TEST 4] List items for User 1...');
    const user1Items = await stackService.getStackItems(user1Id);
    if (user1Items.length !== 2) throw new Error(`Expected 2 items, got ${user1Items.length}`);
    console.log('✓ Successfully retrieved 2 stack items for User 1');

    // 4. Retrieve single item
    console.log('\n[TEST 5] Retrieve single item by ID...');
    const fetched = await stackService.getStackItemById(createdItemId, user1Id);
    if (fetched.product_name !== 'HTTP Server') throw new Error('Retrieved item mismatch');
    console.log('✓ Retrieved single item correctly:', fetched.product_name, `(Vendor: ${fetched.vendor})`);

    // 5. Update item
    console.log('\n[TEST 6] Update stack item...');
    const updated = await stackService.updateStackItem(createdItemId, user1Id, {
      vendor: 'Apache Software Foundation',
      product_name: 'HTTP Server',
      installed_version: '2.4.58', // Upgraded version
      notes: 'Upgraded to patch CVE vulnerabilities',
    });
    if (updated.installed_version !== '2.4.58') throw new Error('Update failed');
    console.log('✓ Updated item version to:', updated.installed_version);

    // 6. User Isolation / Multi-tenancy check
    console.log('\n[TEST 7] User Isolation: User 2 listing items (should be empty)...');
    const user2Items = await stackService.getStackItems(user2Id);
    if (user2Items.length !== 0) throw new Error('User 2 can see User 1 items!');
    console.log('✓ User 2 has 0 items (correctly isolated)');

    console.log('\n[TEST 8] User Isolation: User 2 attempting to view User 1 item (should 404)...');
    try {
      await stackService.getStackItemById(createdItemId, user2Id);
      throw new Error('User 2 was able to view User 1 item!');
    } catch (err) {
      console.log('✓ User 2 blocked from viewing User 1 item:', err.message);
    }

    console.log('\n[TEST 9] User Isolation: User 2 attempting to update User 1 item (should 404)...');
    try {
      await stackService.updateStackItem(createdItemId, user2Id, {
        product_name: 'Hacked',
        installed_version: '0.0.0',
      });
      throw new Error('User 2 was able to modify User 1 item!');
    } catch (err) {
      console.log('✓ User 2 blocked from updating User 1 item:', err.message);
    }

    console.log('\n[TEST 10] User Isolation: User 2 attempting to delete User 1 item (should 404)...');
    try {
      await stackService.deleteStackItem(createdItemId, user2Id);
      throw new Error('User 2 was able to delete User 1 item!');
    } catch (err) {
      console.log('✓ User 2 blocked from deleting User 1 item:', err.message);
    }

    // 7. Delete item
    console.log('\n[TEST 11] User 1 deletes their own item...');
    const deleteRes = await stackService.deleteStackItem(createdItemId, user1Id);
    console.log('✓ Item deleted response:', deleteRes.message);

    const remainingItems = await stackService.getStackItems(user1Id);
    if (remainingItems.length !== 1) throw new Error('Item was not deleted');
    console.log('✓ User 1 now has 1 remaining item');

    console.log('\n===========================================');
    console.log('ALL STACK MANAGEMENT BACKEND TESTS PASSED!');
    console.log('===========================================\n');
  } catch (err) {
    console.error('\n❌ Stack test failed:', err);
    process.exit(1);
  } finally {
    // Cleanup test data
    if (user1Id) {
      await pool.query('DELETE FROM stack_items WHERE user_id = $1', [user1Id]);
      await pool.query('DELETE FROM users WHERE id = $1', [user1Id]);
    }
    if (user2Id) {
      await pool.query('DELETE FROM stack_items WHERE user_id = $1', [user2Id]);
      await pool.query('DELETE FROM users WHERE id = $1', [user2Id]);
    }
    console.log('Test cleanup completed.');
    await pool.end();
  }
}

runStackTests();

