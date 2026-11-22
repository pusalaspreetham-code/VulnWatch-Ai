const pool = require('./src/db');
const catalogService = require('./src/services/catalog.service');
const stackService = require('./src/services/stack.service');
const userRepository = require('./src/repositories/user.repository');
const bcrypt = require('bcrypt');

async function runCatalogAndDashboardTests() {
  console.log('\n===========================================');
  console.log('STARTING CATALOG & DASHBOARD TESTS');
  console.log('===========================================\n');

  const userEmail = `catalog_test_${Date.now()}@example.com`;
  const passwordHash = await bcrypt.hash('SecurePass123!#', 10);
  let userId, createdItemId;

  try {
    const user = await userRepository.createUser({ email: userEmail, passwordHash, isVerified: true });
    userId = user.id;
    console.log(`Created test user #${userId} (${userEmail})`);

    // 1. Catalog search tests
    console.log('\n[TEST 1] Searching catalog for "php"...');
    const phpResults = await catalogService.searchCatalog({ query: 'php' });
    if (!phpResults || phpResults.length === 0) throw new Error('PHP not found in catalog');
    const phpProduct = phpResults[0];
    console.log(`✓ Found: ${phpProduct.vendor} - ${phpProduct.product_name} (${phpProduct.category})`);
    console.log('✓ PHP known versions:', phpProduct.known_versions);
    if (!phpProduct.known_versions || !phpProduct.known_versions.includes('8.3.14')) {
      throw new Error('PHP known versions missing expected versions');
    }

    // 2. Search by category
    console.log('\n[TEST 2] Searching catalog for category "Database"...');
    const dbResults = await catalogService.searchCatalog({ category: 'Database' });
    console.log(`✓ Found ${dbResults.length} database products in catalog`);
    if (dbResults.length < 5) throw new Error('Expected at least 5 database products in catalog');

    // 3. Category listing
    console.log('\n[TEST 3] Fetching catalog categories...');
    const categories = await catalogService.getCategories();
    console.log('✓ Catalog categories count:', categories.length);
    console.log('✓ Categories sample:', categories.slice(0, 3).map(c => `${c.category} (${c.product_count})`).join(', '));

    // 4. Create stack item from catalog product (e.g. PHP 8.3.14)
    console.log('\n[TEST 4] Adding catalog product to monitored stack...');
    const stackItem = await stackService.createStackItem(userId, {
      catalog_product_id: phpProduct.id,
      installed_version: '8.3.14',
      notes: 'API gateway backend runtime',
    });
    createdItemId = stackItem.id;
    console.log('✓ Added item ID:', stackItem.id, 'Product:', stackItem.product_name, 'Version:', stackItem.installed_version);

    // 5. Fetch user stack items and check joined catalog metadata
    console.log('\n[TEST 5] Listing user stack items with joined catalog metadata...');
    const userItems = await stackService.getStackItems(userId);
    if (userItems.length !== 1) throw new Error('Expected 1 item');
    const item = userItems[0];
    console.log('✓ Retrieved item:', item.product_name, 'v' + item.installed_version);
    console.log('✓ Joined category:', item.category);
    console.log('✓ Joined known versions available:', item.known_versions ? item.known_versions.length : 0);

    // 6. Add custom product
    console.log('\n[TEST 6] Adding custom unlisted product to stack...');
    const customItem = await stackService.createStackItem(userId, {
      product_name: 'InHouseAuthGateway',
      vendor: 'Internal Security Team',
      installed_version: '1.2.0-beta',
      notes: 'Proprietary proxy',
    });
    console.log('✓ Custom item created:', customItem.product_name, 'v' + customItem.installed_version);

    const allItems = await stackService.getStackItems(userId);
    console.log(`✓ Total monitored stack items for user: ${allItems.length}`);
    if (allItems.length !== 2) throw new Error('Expected 2 total items');

    // 7. Update stack item version
    console.log('\n[TEST 7] Updating stack item version to 8.3.15...');
    const updated = await stackService.updateStackItem(createdItemId, userId, {
      installed_version: '8.3.15',
      notes: 'Patched to latest minor',
    });
    console.log('✓ Updated version successfully to:', updated.installed_version);

    // 8. Delete stack item
    console.log('\n[TEST 8] Deleting stack item...');
    const delRes = await stackService.deleteStackItem(createdItemId, userId);
    console.log('✓ Delete response:', delRes.message);

    console.log('\n===========================================');
    console.log('ALL CATALOG & DASHBOARD BACKEND TESTS PASSED!');
    console.log('===========================================\n');
  } catch (err) {
    console.error('\n❌ Test error:', err);
    process.exit(1);
  } finally {
    if (userId) {
      await pool.query('DELETE FROM stack_items WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    console.log('Cleanup completed.');
    await pool.end();
  }
}

runCatalogAndDashboardTests();

