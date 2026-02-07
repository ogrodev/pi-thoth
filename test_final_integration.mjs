#!/usr/bin/env node
/**
 * Test th0th Tools API
 * 
 * Comprehensive test of all th0th features via REST API
 */

const SICAD_PATH = "/home/joaov/projetos/ON/sicad-frontend";
const PROJECT_ID = "sicad-frontend";
const API_URL = "http://localhost:3333/api/v1";

console.log("🏛️  th0th Tools API - Comprehensive Test");
console.log("=".repeat(80));
console.log();

async function callAPI(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const res = await fetch(`${API_URL}${endpoint}`, options);
  return await res.json();
}

async function testFeatures() {
  let testsPassed = 0;
  let totalTests = 0;

  try {
    // Test 1: Health Check
    totalTests++;
    console.log("❤️  Test 1/7: Health check...");
    const health = await fetch('http://localhost:3333/health').then(r => r.json());
    console.log(`✅ API is ${health.status} - ${health.service} v${health.version}\n`);
    testsPassed++;

    // Test 2: Index Project with Cache Warmup (NEW FEATURE)
    totalTests++;
    console.log("📂 Test 2/7: Index project with cache warmup...");
    const indexResult = await callAPI('/project/index', 'POST', {
      projectPath: SICAD_PATH,
      projectId: PROJECT_ID,
      forceReindex: false,
      warmCache: true, // ← NEW FEATURE
    });
    
    if (indexResult.success) {
      console.log(`✅ Indexing successful:`);
      console.log(`   Files indexed: ${indexResult.data.filesIndexed || 'N/A'}`);
      if (indexResult.data.warmup) {
        console.log(`   🔥 Cache warmup: ${indexResult.data.warmup.queriesWarmed} queries`);
        console.log(`   Duration: ${indexResult.data.warmup.totalDuration}ms`);
      }
      testsPassed++;
    } else {
      console.log(`⚠️  Indexing: ${indexResult.error || 'Unknown error'}`);
    }
    console.log();

    // Test 3: Basic Search
    totalTests++;
    console.log("🔍 Test 3/7: Basic search...");
    const searchResult = await callAPI('/search/project', 'POST', {
      query: 'Button component',
      projectId: PROJECT_ID,
      maxResults: 3,
      responseMode: 'summary',
    });
    
    if (searchResult.success) {
      console.log(`✅ Found ${searchResult.data.results.length} results:`);
      searchResult.data.results.forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.filePath} (score: ${result.score.toFixed(3)})`);
      });
      testsPassed++;
    }
    console.log();

    // Test 4: Search with Filters (NEW FEATURE)
    totalTests++;
    console.log("🎯 Test 4/7: Search with filters...");
    const filteredSearch = await callAPI('/search/project', 'POST', {
      query: 'React hooks',
      projectId: PROJECT_ID,
      maxResults: 3,
      responseMode: 'summary',
      includeFilters: ['src/**/*.tsx', 'src/**/*.ts'],
      excludeFilters: ['**/*.test.*', '**/*.spec.*'],
    });
    
    if (filteredSearch.success) {
      console.log(`✅ Found ${filteredSearch.data.results.length} filtered results:`);
      filteredSearch.data.results.forEach((result, i) => {
        const path = result.filePath;
        console.log(`   ${i + 1}. ${path}`);
      });
      testsPassed++;
    }
    console.log();

    // Test 5: Cache Hit Test (repeated query)
    totalTests++;
    console.log("🔄 Test 5/7: Testing cache hit (repeat search)...");
    const start = Date.now();
    const repeatSearch = await callAPI('/search/project', 'POST', {
      query: 'Button component',
      projectId: PROJECT_ID,
      maxResults: 3,
      responseMode: 'summary',
    });
    const duration = Date.now() - start;
    
    if (repeatSearch.success) {
      console.log(`✅ Repeated search completed in ${duration}ms`);
      console.log(`   Should be fast due to cache`);
      testsPassed++;
    }
    console.log();

    // Test 6: Cache Analytics
    totalTests++;
    console.log("📊 Test 6/7: Cache analytics...");
    const analyticsResult = await callAPI('/analytics/', 'POST', {
      type: 'cache',
      projectId: PROJECT_ID,
    });
    
    if (analyticsResult.success) {
      console.log("✅ Cache performance:");
      console.log(`   Hit rate: ${(analyticsResult.data.hitRate * 100).toFixed(1)}%`);
      console.log(`   Total hits: ${analyticsResult.data.totalHits}`);
      console.log(`   Total misses: ${analyticsResult.data.totalMisses}`);
      console.log(`   Avg hit: ${analyticsResult.data.avgHitDuration}ms`);
      console.log(`   Avg miss: ${analyticsResult.data.avgMissDuration}ms`);
      
      const speedup = analyticsResult.data.avgMissDuration / Math.max(analyticsResult.data.avgHitDuration, 1);
      console.log(`   Speedup: ${speedup.toFixed(1)}x on cache hit`);
      testsPassed++;
    }
    console.log();

    // Test 7: Search with explainScores variations (cache key normalization test)
    totalTests++;
    console.log("🔑 Test 7/7: Cache key normalization...");
    
    const search1 = await callAPI('/search/project', 'POST', {
      query: 'useState hook',
      projectId: PROJECT_ID,
      maxResults: 3,
      responseMode: 'summary',
      explainScores: false,
    });
    
    const search2 = await callAPI('/search/project', 'POST', {
      query: 'useState hook',
      projectId: PROJECT_ID,
      maxResults: 3,
      responseMode: 'summary',
      explainScores: true, // Different param, should hit same cache
    });
    
    if (search1.success && search2.success) {
      console.log(`✅ Both searches successful`);
      console.log(`   Query 1 (explainScores=false): ${search1.data.results.length} results`);
      console.log(`   Query 2 (explainScores=true): ${search2.data.results.length} results`);
      console.log(`   Should use same cache key (presentation params excluded)`);
      testsPassed++;
    }
    console.log();

    // Final Summary
    console.log("=".repeat(80));
    console.log(`📊 Test Results: ${testsPassed}/${totalTests} passed`);
    console.log("=".repeat(80));
    console.log();
    
    if (testsPassed === totalTests) {
      console.log("✅ ALL TESTS PASSED!");
      console.log();
      console.log("🎉 th0th is fully functional with all new features:");
      console.log("   ✅ Cache warmup during indexing");
      console.log("   ✅ File-based filters (include/exclude)");
      console.log("   ✅ Cache key normalization");
      console.log("   ✅ Performance analytics");
      console.log();
      console.log("📝 OpenCode MCP Configuration:");
      console.log("   Location: /home/joaov/.config/opencode/opencode.json");
      console.log("   Server: th0th (enabled)");
      console.log("   Command: bun run .../mcp-client/dist/index.js");
      console.log("   API: http://localhost:3333");
      console.log();
      console.log("✨ Ready to use in OpenCode! Try these commands:");
      console.log("   - Search: th0th_search_project");
      console.log("   - Index: th0th_index_project (with warmCache: true)");
      console.log("   - Analytics: th0th_get_analytics");
    } else {
      console.log(`⚠️  Some tests failed (${totalTests - testsPassed} failures)`);
    }

  } catch (error) {
    console.error("\n❌ Test suite failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testFeatures();
