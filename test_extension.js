// COMPREHENSIVE EXTENSION TEST SCRIPT
// Copy and paste this into browser console on HH resume page

console.log('🧪 STARTING COMPREHENSIVE EXTENSION TEST');

// Test 1: Check if extension is loaded
console.log('\n📋 TEST 1: Extension Loading Check');
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
  console.log('✅ Chrome extension API available');
  console.log('📦 Extension ID:', chrome.runtime.id);
} else {
  console.log('❌ Chrome extension API not available');
}

// Test 2: Check for content script
console.log('\n📋 TEST 2: Content Script Check');
const scripts = document.querySelectorAll('script');
let contentScriptFound = false;
scripts.forEach(script => {
  if (script.src && script.src.includes('resumeBooster')) {
    contentScriptFound = true;
    console.log('✅ Content script found:', script.src);
  }
});
if (!contentScriptFound) {
  console.log('❌ Content script not found in page');
}

// Test 3: Manual button search (same logic as extension)
console.log('\n📋 TEST 3: Manual Button Search');

// Exact text matches
const exactTextMatches = [
  'Поднять в поиске',
  'Поднять резюме', 
  'Поднять',
  'Обновить резюме',
  'Обновить'
];

let foundButton = null;

console.log('🎯 Step 1: Looking for exact text matches...');
for (const exactText of exactTextMatches) {
  const allElements = document.querySelectorAll('button, a, [role="button"]');
  for (let i = 0; i < allElements.length; i++) {
    const element = allElements[i];
    const elementText = element.textContent?.trim() || '';
    
    if (elementText === exactText) {
      console.log(`✅ Found exact match for "${exactText}":`, element);
      foundButton = element;
      break;
    }
  }
  if (foundButton) break;
}

if (!foundButton) {
  console.log('🎯 Step 2: Looking for partial text matches...');
  for (const partialText of exactTextMatches) {
    const allElements = document.querySelectorAll('button, a, [role="button"]');
    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i];
      const elementText = element.textContent?.trim() || '';
      
      if (elementText.includes(partialText)) {
        console.log(`✅ Found partial match for "${partialText}":`, element);
        foundButton = element;
        break;
      }
    }
    if (foundButton) break;
  }
}

if (!foundButton) {
  console.log('🎯 Step 3: Aggressive keyword search...');
  const allClickableElements = document.querySelectorAll(
    'button, a, [role="button"], [class*="button"], [class*="btn"], span[onclick], div[onclick]'
  );
  
  const boostKeywords = [
    'поднять', 'boost', 'raise', 'update', 'обновить', 'продвинуть', 'refresh'
  ];
  
  for (let i = 0; i < allClickableElements.length; i++) {
    const element = allClickableElements[i];
    const text = element.textContent?.toLowerCase().trim() || '';
    const dataQa = element.getAttribute('data-qa')?.toLowerCase() || '';
    const className = element.className?.toLowerCase() || '';
    
    for (const keyword of boostKeywords) {
      if (text.includes(keyword) || dataQa.includes(keyword) || className.includes(keyword)) {
        console.log(`✅ Found potential boost button via keyword "${keyword}":`, element);
        foundButton = element;
        break;
      }
    }
    if (foundButton) break;
  }
}

// Test 4: Button analysis
console.log('\n📋 TEST 4: Button Analysis');
if (foundButton) {
  console.log('✅ Button found!');
  console.log('📊 Button details:', {
    text: foundButton.textContent?.trim(),
    dataQa: foundButton.getAttribute('data-qa'),
    className: foundButton.className,
    tagName: foundButton.tagName,
    disabled: foundButton.disabled || foundButton.getAttribute('aria-disabled') === 'true',
    visible: foundButton.offsetParent !== null,
    clickable: !foundButton.disabled && foundButton.offsetParent !== null
  });
  
  // Test button state
  const isActive = !foundButton.hasAttribute('disabled') && 
                   foundButton.getAttribute('aria-disabled') !== 'true' &&
                   foundButton.offsetParent !== null;
  
  console.log('🔍 Button state:', isActive ? '✅ ACTIVE' : '❌ INACTIVE');
  
} else {
  console.log('❌ No boost button found');
  
  // Debug: show all buttons
  const allButtons = document.querySelectorAll('button, a, [role="button"]');
  console.log(`📋 All buttons on page (${allButtons.length} total):`);
  allButtons.forEach((btn, index) => {
    if (index < 10) { // Show first 10
      console.log(`  ${index + 1}. "${btn.textContent?.trim()}" (${btn.tagName})`);
    }
  });
}

// Test 5: Extension communication
console.log('\n📋 TEST 5: Extension Communication Test');
if (typeof chrome !== 'undefined' && chrome.runtime) {
  try {
    chrome.runtime.sendMessage({type: 'GET_STATE'}, (response) => {
      if (chrome.runtime.lastError) {
        console.log('❌ Extension communication failed:', chrome.runtime.lastError);
      } else {
        console.log('✅ Extension communication successful:', response);
      }
    });
  } catch (error) {
    console.log('❌ Extension communication error:', error);
  }
} else {
  console.log('❌ Chrome runtime not available');
}

// Test 6: Manual click test (if button found)
if (foundButton) {
  console.log('\n📋 TEST 6: Manual Click Test');
  console.log('🎯 Attempting to click button manually...');
  
  // Scroll into view
  foundButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  setTimeout(() => {
    try {
      // Method 1: Direct click
      foundButton.click();
      console.log('✅ Direct click executed');
      
      // Check if button state changed
      setTimeout(() => {
        const isStillActive = !foundButton.hasAttribute('disabled') && 
                             foundButton.getAttribute('aria-disabled') !== 'true';
        console.log('📊 Button state after click:', isStillActive ? 'Still active' : 'Now inactive (success!)');
      }, 1000);
      
    } catch (error) {
      console.log('❌ Manual click failed:', error);
    }
  }, 1000);
}

console.log('\n🏁 TEST COMPLETED - Check results above');
console.log('📝 If button was found and clicked, check if resume was actually boosted on the page'); 