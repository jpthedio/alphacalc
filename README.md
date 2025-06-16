# AlphaCalc.js

**Build Complex Calculators with Simple Attributes in Webflow** 

Build and manage complex Webflow calculators in minutes with AlphaCalc.js. Just add simple attributes – no JavaScript needed. Save time, launch faster, and boost your earnings with mortgage, pricing, and ROI calculators made easy.

![Version](https://img.shields.io/badge/version-2.2.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Demo

See AlphaCalc.js in action on our [WEBFLOW DEMO](https://alphacalc-js.webflow.io/), [WEBFLOW READ-ONLY](https://preview.webflow.com/preview/alphacalc-js?utm_medium=preview_link&utm_source=designer&utm_content=alphacalc-js&preview=1b5cec2a238a9836f4068a312194ce2e&workflow=preview).

## Overview

AlphaCalc.js transforms your Webflow site into a powerful calculation engine using a simple declarative approach. Whether you're building mortgage calculators, ROI estimators, pricing tools, or custom form builders, AlphaCalc gives you the flexibility of custom JavaScript with the simplicity of Webflow's visual design tools.

## Pain Points Solved
- **No-Code Solution**: Create complex calculators without JavaScript knowledge
- **Form Integration**: Works seamlessly with Webflow's native form elements
- **Real-Time Calculation**: Instant feedback as users interact with inputs
- **Responsive Design**: Mobile-ready calculators that look great on all devices
- **Custom Formulas**: Simple formula syntax for complex calculations
- **Multiple Input Types**: Works with text, number, select, radio, checkbox inputs
- **Complex UI Support**: Compatible with Finsweet attributes and custom UI elements

## Quick Start

Add this script to your project before the closing `</body>` tag:

```html
<!-- AlphaCalc.js - Webflow Calculator Library -->
<script defer src="https://cdn.jsdelivr.net/gh/jpthedio/alphacalc@2.2.0/dist/alphacalc.min.js"></script>
```

Create a simple calculator:

```html
<div data-alphacalc-calculator="SimpleCalc">
  <label>
    Price: $<input data-alphacalc-input="price" type="number" value="100">
  </label>
  
  <label>
    Quantity: <input data-alphacalc-input="quantity" type="number" value="2">
  </label>
  
  <div>
    Total: $<span data-alphacalc-output="= price * quantity">200</span>
  </div>
</div>
```

## Examples

### Price Calculator with Discounts

```html
<div data-alphacalc-calculator="PriceCalc">
  <label>
    Base Price: $<input data-alphacalc-input="base" type="number" value="100">
  </label>
  
  <label>
    Quantity: <input data-alphacalc-input="qty" type="number" value="1">
  </label>
  
  <div>
    <label>
      <input data-alphacalc-input="discount" data-alphacalc-group="discounts" type="checkbox" data-alphacalc-value="10"> 
      10% Discount
    </label>
    
    <label>
      <input data-alphacalc-input="sale" data-alphacalc-group="discounts" type="checkbox" data-alphacalc-value="5"> 
      5% Sale
    </label>
  </div>
  
  <div>
    <h3>Subtotal: $<span data-alphacalc-output="= base * qty">100</span></h3>
    <h3>Discount: $<span data-alphacalc-output="= base * qty * (discounts/100)">0</span></h3>
    <h3>Total: $<span data-alphacalc-output="= base * qty * (1 - discounts/100)">100</span></h3>
  </div>
</div>
```

### Mortgage Calculator

```html
<div data-alphacalc-calculator="MortgageCalc">
  <label>
    Loan Amount: $
    <input data-alphacalc-input="principal" type="number" value="200000">
  </label>
  
  <label>
    Interest Rate (%):
    <input data-alphacalc-input="rate" type="number" value="4.5">
  </label>
  
  <label>
    Loan Term:
    <select data-alphacalc-input="term">
      <option value="15">15 years</option>
      <option value="30" selected>30 years</option>
    </select>
  </label>
  
  <div>
    <h3>Monthly Payment: $<span data-alphacalc-output="= principal * (rate/100/12) * Math.pow(1 + rate/100/12, term*12) / (Math.pow(1 + rate/100/12, term*12) - 1)" data-alphacalc-decimals="2">1013.37</span></h3>
    <h3>Total Cost: $<span data-alphacalc-output="= (principal * (rate/100/12) * Math.pow(1 + rate/100/12, term*12) / (Math.pow(1 + rate/100/12, term*12) - 1)) * term * 12" data-alphacalc-decimals="2">364813.20</span></h3>
  </div>
</div>
```

## Key Features

### 1. Finsweet Integration

AlphaCalc works seamlessly with Finsweet custom UI components:

```html
<!-- Finsweet Range Slider -->
<div fs-rangeslider-element="wrapper" fs-rangeslider-min="1" fs-rangeslider-max="8" fs-rangeslider-step="0.1">
  <input data-alphacalc-input="interestRate" fs-rangeslider-element="input" type="text" value="5.5">
  <div fs-rangeslider-element="track">
    <div fs-rangeslider-element="handle"></div>
    <div fs-rangeslider-element="fill"></div>
  </div>
</div>

<!-- Finsweet Custom Radio Group -->
<div role="radiogroup">
  <label class="fs_radio-field">
    <div class="fs_radio-button"></div>
    <input data-alphacalc-input="period1" data-alphacalc-group="period" type="radio" name="period" data-alphacalc-value="5" checked>
    <span class="fs_radio-label">5 Years</span>
  </label>
</div>
```

### 2. Multiple Input Types

AlphaCalc supports various input types:

```html
<!-- Text/Number inputs -->
<input data-alphacalc-input="price" type="number" value="100">

<!-- Select dropdowns -->
<select data-alphacalc-input="plan">
  <option value="10">Basic ($10)</option>
  <option value="20">Pro ($20)</option>
</select>

<!-- Radio buttons -->
<input data-alphacalc-input="term" data-alphacalc-group="terms" type="radio" name="term" data-alphacalc-value="12" checked> 12 months
<input data-alphacalc-input="term2" data-alphacalc-group="terms" type="radio" name="term" data-alphacalc-value="24"> 24 months

<!-- Checkboxes -->
<input data-alphacalc-input="feature1" data-alphacalc-group="features" type="checkbox" data-alphacalc-value="5"> Feature 1 (+$5)
```

### 2. Real-Time Formulas

Display calculation results with simple formulas:

Formulas are detected automatically if the attribute contains math operators.
You can start the value with an `=` for clarity, but it's optional.

```html
<!-- Basic arithmetic -->
<div data-alphacalc-output="= price * quantity">200</div>

<!-- Complex formulas -->
<div data-alphacalc-output="= (subtotal * (1 + tax/100)) + shipping">129.50</div>
<!-- Without '=' prefix -->
<div data-alphacalc-output="price * quantity">200</div>
```

### 3. Custom Configurations

Add calculator configurations:

```html
<div 
  data-alphacalc-calculator="AdvancedCalc"
  data-alphacalc-debug="true"
  data-alphacalc-debounce="200"
  data-alphacalc-defaultfromdecimals="2"
  data-alphacalc-defaultinputdecimals="4"
  data-alphacalc-allowsubmit="false"
>
  <!-- Calculator elements -->
</div>
```

### 4. Loading Indicators & Active States

Show activity during calculations:

```html
<!-- Loading indicator -->
<div data-alphacalc-element="loading" data-alphacalc-classactive="is-active" class="loading-spinner"></div>

<!-- Elements with active state during calculation -->
<div data-alphacalc-output="total" data-alphacalc-classactive="is-calculating">100</div>
```

## Real-World Example: ROI Mortgage Calculator

Our [demo site](https://mbcalc.webflow.io/) features a complete ROI Mortgage Calculator that demonstrates the full capabilities of AlphaCalc.js:

```html
<div data-alphacalc-calculator="ROI Mortage" data-alphacalc-debug="true" data-alphacalc-debounce="200">
  <!-- Current Loan Amount -->
  <label>
    <div>Current Loan Amount ($):</div>
    <input data-alphacalc-input="N1" type="number" data-alphacalc-value="25000">
    <div class="button-group">
      <button data-alphacalc-set="N1" data-alphacalc-value="25000">25K</button>
      <button data-alphacalc-set="N1" data-alphacalc-value="50000">50K</button>
      <button data-alphacalc-set="N1" data-alphacalc-value="75000">75K</button>
    </div>
  </label>
  
  <!-- Current Interest Rate with Range Slider -->
  <label>
    <div>Current Interest Rate (%):</div>
    <div fs-rangeslider-element="wrapper" fs-rangeslider-min="1" fs-rangeslider-max="8" fs-rangeslider-step="0.1">
      <input data-alphacalc-input="S1" fs-rangeslider-element="input" type="text" value="6">
      <div fs-rangeslider-element="track">
        <div fs-rangeslider-element="handle"></div>
        <div fs-rangeslider-element="fill"></div>
      </div>
    </div>
  </label>
  
  <!-- Results -->
  <div class="results-block">
    <div>Monthly Payment Reduction:</div>
    <h4>$<span data-alphacalc-output="= N1 * S1 / 100 / 12 - N1 * S2 / 100 / 12" data-alphacalc-decimals="0">73</span></h4>
  </div>
  
  <!-- Loading Indicator -->
  <div data-alphacalc-element="loading" data-alphacalc-classactive="is-active" class="loading-spinner"></div>
</div>
```

## Browser Support

AlphaCalc.js supports all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- iOS Safari (latest)
- Android Chrome (latest)

## Documentation

See the [full documentation](https://github.com/jpthedio/alphacalc/tree/main/docs) for detailed instructions and examples.

## Roadmap

We're constantly improving AlphaCalc. Upcoming features include:
- CMS integration
- Query parameter support for setting values and generating links
- Enhanced debugging tools with better formula detection
- More formula expressions (SUM, SQRT, ABS, etc.)
- Graph generation for results
- GSAP animation support for results
- Expanded Finsweet component compatibility

See our [roadmap](https://github.com/jpthedio/alphacalc/discussions/1) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you have any questions or need support, please open an issue on GitHub. Or message me [@jpthedio](https://twitter.com/jpthedio)
