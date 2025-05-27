// Debug script to inject into HH page console
console.log('=== BUTTON DEBUG SCRIPT ===');

// Find all buttons on the page
const allButtons = document.querySelectorAll('button, a, [role="button"], [class*="button"], [class*="btn"]');
console.log(`Found ${allButtons.length} clickable elements`);

// Look for boost button specifically
const boostKeywords = ['поднять', 'boost', 'raise', 'update', 'обновить', 'продвинуть'];
let foundButtons = [];

allButtons.forEach((btn, index) => {
  const text = btn.textContent?.toLowerCase().trim() || '';
  const dataQa = btn.getAttribute('data-qa')?.toLowerCase() || '';
  const className = btn.className?.toLowerCase() || '';
  
  for (const keyword of boostKeywords) {
    if (text.includes(keyword) || dataQa.includes(keyword) || className.includes(keyword)) {
      foundButtons.push({
        index,
        element: btn,
        text: btn.textContent?.trim(),
        dataQa: btn.getAttribute('data-qa'),
        className: btn.className,
        disabled: btn.disabled || btn.getAttribute('aria-disabled') === 'true',
        visible: btn.offsetParent !== null,
        clickable: !btn.disabled && btn.offsetParent !== null
      });
      break;
    }
  }
});

console.log('=== BOOST BUTTONS FOUND ===');
foundButtons.forEach((btn, i) => {
  console.log(`${i + 1}. "${btn.text}"`);
  console.log(`   Data-QA: ${btn.dataQa}`);
  console.log(`   Classes: ${btn.className}`);
  console.log(`   Disabled: ${btn.disabled}`);
  console.log(`   Visible: ${btn.visible}`);
  console.log(`   Clickable: ${btn.clickable}`);
  console.log(`   Element:`, btn.element);
  console.log('---');
});

// Try to click the first found button
if (foundButtons.length > 0) {
  const targetButton = foundButtons[0];
  console.log(`Attempting to click: "${targetButton.text}"`);
  
  if (targetButton.clickable) {
    // Scroll into view
    targetButton.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    setTimeout(() => {
      // Try multiple click methods
      console.log('Trying click methods...');
      
      // Method 1: Direct click
      try {
        targetButton.element.click();
        console.log('✅ Direct click executed');
      } catch (e) {
        console.log('❌ Direct click failed:', e);
      }
      
      // Method 2: Mouse event
      try {
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        targetButton.element.dispatchEvent(clickEvent);
        console.log('✅ Mouse event dispatched');
      } catch (e) {
        console.log('❌ Mouse event failed:', e);
      }
      
      // Method 3: Focus and Enter
      try {
        targetButton.element.focus();
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          bubbles: true
        });
        targetButton.element.dispatchEvent(enterEvent);
        console.log('✅ Enter key event dispatched');
      } catch (e) {
        console.log('❌ Enter key failed:', e);
      }
      
    }, 1000);
  } else {
    console.log('❌ Button is not clickable');
  }
} else {
  console.log('❌ No boost buttons found');
}

console.log('=== END DEBUG ==='); 