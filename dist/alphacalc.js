/**
 * AlphaCalc 2.2: A modular calculator library for Webflow
 *
 * A powerful, flexible calculator library designed for Webflow projects.
 * This enhanced version offers a simplified API, improved performance,
 * better maintainability, configurable debounce, and loading indicators.
 *
 * @author JP Dionisio
 * @website https://dionisio.jp/
 * @version 2.2.0
 * @license MIT
 *
 * @ai-models
 * - Claude 3.7 Sonnet by Anthropic
 * - ChatGPT o3-mini-high by OpenAI
 *
 * @development-notes
 * Collaborative development with AI assistance to enhance
 * library design, documentation, and code quality.
 */

;(function (root, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory()
    } else if (typeof define === 'function' && define.amd) {
        define(factory)
    } else {
        root.AlphaCalc = factory()
        window.AlphaCalc = root.AlphaCalc // For global access
    }
})(typeof window !== 'undefined' ? window : this, function () {
    /**
     * Default configuration for AlphaCalc instances
     *
     * @type {Object}
     * @property {Object} selectors - Query selectors for different element types
     * @property {Object} decimal - Decimal precision settings
     * @property {Object} features - Feature toggles and operational settings
     * @property {Object} formatting - Number formatting options
     */
    const DEFAULT_CONFIG = {
        // Selectors for elements
        selectors: {
            input: '[data-alphacalc-input]',
            getter: '[data-alphacalc-output], [data-alphacalc-from]', // Support both new and legacy attribute
            setter: '[data-alphacalc-set], [data-alphacalc-to]',
            submit: '[data-alphacalc-submit], [data-alphacalc-element="submit"], [data-alphacalc-calculate], [data-alphacalc-element="calculate"]',
            calculator: '[data-alphacalc-calculator]',
            loading: '[data-alphacalc-element="loading"]', // Loading element selector
        },
        // Decimal precision settings
        decimal: {
            input: 4,
            display: 2,
        },
        // Feature flags
        features: {
            autoCalculate: true,
            debug: false,
            debounceTime: 50, // Default debounce time in milliseconds
            allowLegacyAttributes: true, // Support legacy attributes for backwards compatibility
            showDeprecationWarnings: true, // Show deprecation warnings in console
        },
        // Formatting options
        formatting: {
            style: 'decimal',
            useGrouping: true,
        },
    }

    /**
     * Utility functions for common operations
     *
     * @namespace
     * @property {Function} mergeDeep - Deep merge objects (similar to Object.assign but for nested objects)
     * @property {Function} debounce - Limit execution rate of a function
     * @property {Function} parseNumeric - Parse a value to a number, handling various formats
     * @property {Function} formatNumber - Format a number according to options
     */
    const Util = {
        /**
         * Deep merge objects (similar to Object.assign but for nested objects)
         */
        mergeDeep(...objects) {
            const isObject = (obj) => obj && typeof obj === 'object'

            return objects.reduce((prev, obj) => {
                if (!isObject(prev) || !isObject(obj)) return obj

                Object.keys(obj).forEach((key) => {
                    const pVal = prev[key]
                    const oVal = obj[key]

                    if (Array.isArray(pVal) && Array.isArray(oVal)) {
                        prev[key] = pVal.concat(...oVal)
                    } else if (isObject(pVal) && isObject(oVal)) {
                        prev[key] = this.mergeDeep(pVal, oVal)
                    } else {
                        prev[key] = oVal
                    }
                })

                return prev
            }, {})
        },

        /**
         * Debounce function to limit execution rate
         */
        debounce(func, wait) {
            let timeout
            return function (...args) {
                const context = this
                clearTimeout(timeout)
                timeout = setTimeout(() => func.apply(context, args), wait)
            }
        },

        /**
         * Parse a value to a number, handling various formats
         */
        parseNumeric(value) {
            if (value === undefined || value === null || value === '') return 0
            if (value === true) return 1
            if (value === false) return 0

            // Handle string values
            if (typeof value === 'string') {
                // Remove currency symbols, commas, etc.
                const cleanValue = value.replace(/[^0-9.-]+/g, '')
                const num = parseFloat(cleanValue)
                return isFinite(num) ? num : 0
            }

            // Direct numeric values
            const num = parseFloat(value)
            return isFinite(num) ? num : 0
        },

        /**
         * Format a number according to options
         */
        formatNumber(value, options = {}) {
            const {
                decimals = 2,
                style = 'decimal',
                useGrouping = true,
            } = options

            const formatter = new Intl.NumberFormat(undefined, {
                style,
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
                useGrouping,
            })

            return formatter.format(value)
        },
    }

    /**
     * EventBus - Simple pub/sub implementation for internal communication
     *
     * Provides a central hub for components to communicate with each other
     * without direct coupling. Components can subscribe to events and publish
     * events to notify other components.
     *
     * @class
     */
    class EventBus {
        constructor() {
            this.events = {}
        }

        on(event, callback) {
            if (!this.events[event]) this.events[event] = []
            this.events[event].push(callback)
            return this
        }

        off(event, callback) {
            if (!this.events[event]) return this
            if (!callback) {
                delete this.events[event]
            } else {
                this.events[event] = this.events[event].filter(
                    (cb) => cb !== callback
                )
            }
            return this
        }

        emit(event, data) {
            if (!this.events[event]) return this
            this.events[event].forEach((callback) => callback(data))
            return this
        }
    }

    /**
     * Formula Engine - Handles parsing and evaluation of formulas
     *
     * Responsible for safely evaluating mathematical formulas using the current
     * values from the calculator. Provides context-aware formula evaluation with
     * proper error handling and security measures.
     *
     * @class
     */
    class FormulaEngine {
        constructor(calculator) {
            this.calculator = calculator
        }

        /**
         * Evaluate a formula string using current context values
         */
        evaluate(formula, context = {}) {
            // Basic sanitization - only allow safe characters
            const sanitizedFormula = formula.replace(/[^\w\s+\-*/.()%,]/g, '')

            try {
                // Create function with context variables as parameters
                const keys = Object.keys(context)
                const values = Object.values(context)
                const func = new Function(
                    ...keys,
                    `return ${sanitizedFormula};`
                )

                // Execute the function with context values
                let result = func(...values)

                // Check for valid numeric result
                if (!isFinite(result)) {
                    this.calculator.debugLog(
                        `Formula result is not finite: ${result}`
                    )
                    return 0
                }

                // Round to configured precision
                return parseFloat(
                    result.toFixed(this.calculator.config.decimal.input)
                )
            } catch (error) {
                this.calculator.debugLog('Error evaluating formula:', error)
                return 0
            }
        }
    }

    /**
     * InputManager - Handles input elements and their values
     *
     * Responsible for managing all input elements within the calculator, including:
     * - Registration and tracking of input elements
     * - Reading and writing input values
     * - Attaching and managing event listeners
     * - Handling different input types (text, number, radio, checkbox, select)
     * - Tracking formula inputs for calculation
     *
     * @class
     */
    class InputManager {
        constructor(calculator) {
            this.calculator = calculator
            this.inputValues = new Map()
            this.inputElements = new Map()
            this.listeners = new Map()
            this.formulaInputs = []
        }

        /**
         * Initialize inputs from container
         */
        init() {
            const { container, config } = this.calculator

            // Find all input elements
            const selector = `${config.selectors.input}:not([type="submit"])`
            const inputs = Array.from(container.querySelectorAll(selector))

            // Process each input
            inputs.forEach((input) => this.registerInput(input))

            return this
        }

        /**
         * Register a single input element
         */
        registerInput(input) {
            const cellId = this.getCellId(input)
            if (!cellId) {
                this.calculator.debugLog('Input missing cell identifier', input)
                return
            }

            // Store reference to element
            this.inputElements.set(cellId, input)

            // Get element type and initial value
            const elementType = this.getElementType(input)
            let value = this.getElementValue(input)

            // Store the value
            this.inputValues.set(cellId, value)

            // NEW CODE: For text/number inputs with data-alphacalc-value, update the visible value
            if (
                elementType === 'input' &&
                input.hasAttribute('data-alphacalc-value') &&
                (input.type === 'text' || input.type === 'number')
            ) {
                // Set the visible value
                input.value = value

                // Mark as initialized so we know to use the actual value in future
                input._alphaCalcInitialized = true

                this.calculator.debugLog(
                    `Updated input ${cellId} visible value to ${value}`
                )
            }

            // Check if this is a formula input
            if (input.hasAttribute('data-alphacalc-formula')) {
                this.formulaInputs.push(input)

                // Make formula inputs read-only
                if (elementType === 'input') {
                    input.readOnly = true
                }
            } else {
                // Add event listener for value changes
                this.attachListener(input, cellId)
            }

            return this
        }

        /**
         * Get cell ID from an element (with backward compatibility)
         */
        getCellId(element) {
            // New attribute approach
            if (
                element.hasAttribute('data-alphacalc-input') &&
                element.getAttribute('data-alphacalc-input') !== ''
            ) {
                return element.getAttribute('data-alphacalc-input')
            }

            // Legacy attribute (with optional warning)
            if (
                this.calculator.config.features.allowLegacyAttributes &&
                element.hasAttribute('data-alphacalc-cell')
            ) {
                if (this.calculator.config.features.showDeprecationWarnings) {
                    this.calculator.debugLog(
                        'Deprecated: data-alphacalc-cell is deprecated. ' +
                            'Please use data-alphacalc-input instead.',
                        element
                    )
                }

                return element.getAttribute('data-alphacalc-cell')
            }

            return null
        }

        /**
         * Determine element type based on tag and attributes
         */
        getElementType(element) {
            // Check for explicit type
            const explicitType = element.getAttribute('data-alphacalc-element')
            if (
                explicitType &&
                ['input', 'select', 'radio', 'checkbox'].includes(explicitType)
            ) {
                return explicitType
            }

            // Check by tag and type
            const tagName = element.tagName.toLowerCase()

            if (tagName === 'select') return 'select'

            if (tagName === 'input') {
                const inputType = element.getAttribute('type')
                if (inputType === 'radio') return 'radio'
                if (inputType === 'checkbox') return 'checkbox'
                return 'input'
            }

            return 'input' // Default fallback
        }

        /**
         * Get current value from an element
         */
        getElementValue(element) {
            const elementType = this.getElementType(element)
            let value = 0

            // Handle element type-specific value extraction
            if (elementType === 'select') {
                value = this.getSelectValue(element)
            } else if (elementType === 'radio' || elementType === 'checkbox') {
                value = this.getToggleValue(element)
            } else {
                // Regular input
                // NEW CODE: Only use data-alphacalc-value during initialization for text/number inputs
                const useDataValue =
                    element.hasAttribute('data-alphacalc-value') &&
                    (!element._alphaCalcInitialized ||
                        !(element.type === 'text' || element.type === 'number'))

                const rawValue = useDataValue
                    ? element.getAttribute('data-alphacalc-value')
                    : element.value

                value = Util.parseNumeric(rawValue)
            }

            // Apply min/max constraints
            value = this.clampValue(value, element)

            return value
        }

        /**
         * Get value from select element
         */
        getSelectValue(element) {
            // Handle empty/placeholder selection
            if (element.value === '' || element.value === null) {
                // Use default value if specified
                if (element.hasAttribute('data-alphacalc-default')) {
                    return Util.parseNumeric(
                        element.getAttribute('data-alphacalc-default')
                    )
                }

                // Find first non-empty option
                const firstValidOption = Array.from(element.options).find(
                    (opt) => opt.value !== '' && opt.value !== null
                )

                if (firstValidOption) {
                    return Util.parseNumeric(firstValidOption.value)
                }

                return 0
            }

            // Normal case: use selected option's value
            return Util.parseNumeric(element.value)
        }

        /**
         * Get value from radio or checkbox
         */
        getToggleValue(element) {
            if (!element.checked) return 0

            // Use custom value or input value
            const valueToUse = element.hasAttribute('data-alphacalc-value')
                ? element.getAttribute('data-alphacalc-value')
                : element.value

            return Util.parseNumeric(valueToUse)
        }

        /**
         * Apply min/max constraints to a value
         */
        clampValue(value, element) {
            let result = value

            // Apply min constraint
            if (element.hasAttribute('data-alphacalc-min')) {
                const min = parseFloat(
                    element.getAttribute('data-alphacalc-min')
                )
                if (!isNaN(min)) {
                    result = Math.max(result, min)
                }
            }

            // Apply max constraint
            if (element.hasAttribute('data-alphacalc-max')) {
                const max = parseFloat(
                    element.getAttribute('data-alphacalc-max')
                )
                if (!isNaN(max)) {
                    result = Math.min(result, max)
                }
            }

            return result
        }

        /**
         * Attach appropriate event listener to an element
         */
        attachListener(element, cellId) {
            const elementType = this.getElementType(element)
            const eventType =
                elementType === 'select' ||
                elementType === 'radio' ||
                elementType === 'checkbox'
                    ? 'change'
                    : 'input'

            // Create listener function
            const listener = () => {
                // Special handling for radio buttons
                if (
                    elementType === 'radio' &&
                    element.checked &&
                    element.name
                ) {
                    this.handleRadioChange(element)
                }

                // Get and store new value
                const newValue = this.getElementValue(element)
                this.inputValues.set(cellId, newValue)

                // Update UI and trigger calculation
                this.calculator.events.emit('value:changed', {
                    cellId,
                    value: newValue,
                })

                if (this.calculator.config.features.autoCalculate) {
                    this.calculator.debouncedCalculate()
                }
            }

            // Attach the listener
            element.addEventListener(eventType, listener)

            // Store reference for cleanup
            this.listeners.set(element, { type: eventType, fn: listener })
        }

        /**
         * Special handling for radio button changes
         */
        handleRadioChange(element) {
            // Set all other radios in the same name group to 0
            if (element.name) {
                const radiosWithSameName =
                    this.calculator.container.querySelectorAll(
                        `input[type="radio"][name="${element.name}"]`
                    )

                radiosWithSameName.forEach((radio) => {
                    if (radio !== element) {
                        const radioCellId = this.getCellId(radio)
                        if (radioCellId) {
                            this.inputValues.set(radioCellId, 0)
                            this.calculator.debugLog(
                                `Setting radio ${radioCellId} to 0 (unchecked)`
                            )
                        }
                    }
                })
            }
        }

        /**
         * Set a value for a cell programmatically
         */
        setValue(cellId, value) {
            // Update internal value
            this.inputValues.set(cellId, value)

            // Update the UI element if found
            const element = this.inputElements.get(cellId)
            if (element) {
                const elementType = this.getElementType(element)

                if (elementType === 'select') {
                    // For select, find and select matching option
                    const option = Array.from(element.options).find(
                        (opt) => Util.parseNumeric(opt.value) === value
                    )

                    if (option) {
                        element.value = option.value
                    }
               } else if (
                   elementType === 'radio' ||
                   elementType === 'checkbox'
               ) {
                   // For toggle elements, set checked property
                    const elementRawValue = element.hasAttribute('data-alphacalc-value')
                        ? element.getAttribute('data-alphacalc-value')
                        : element.value
                    const elementValue = Util.parseNumeric(elementRawValue)
                    element.checked = Math.abs(elementValue - value) < 0.001
                } else {
                    // Regular input
                    element.value = value
                }

                // Trigger change event
                element.dispatchEvent(new Event('change', { bubbles: true }))
            }

            // Emit event
            this.calculator.events.emit('value:changed', { cellId, value })

            return this
        }

        /**
         * Clean up event listeners
         */
        destroy() {
            this.listeners.forEach((listenerInfo, element) => {
                element.removeEventListener(listenerInfo.type, listenerInfo.fn)
            })

            this.listeners.clear()
            this.inputValues.clear()
            this.inputElements.clear()
            this.formulaInputs = []

            return this
        }
    }

    /**
     * OutputManager - Handles output/display elements
     *
     * Responsible for managing all display/output elements within the calculator:
     * - Finding and tracking elements with data-alphacalc-output attribute
     * - Updating display elements when values change
     * - Handling formula displays (elements that display formula results)
     * - Managing bidirectional binding between inputs and displays
     * - Formatting output values according to specified options
     *
     * @class
     */
    class OutputManager {
        constructor(calculator) {
            this.calculator = calculator
            this.getterElements = []
            this.listeners = new Map()
        }

        /**
         * Initialize displays/getters
         */
        init() {
            const { container, config } = this.calculator

            // Find all getter elements using the unified selector
            this.getterElements = Array.from(
                container.querySelectorAll(config.selectors.getter)
            )

            // Process legacy display elements (convert to getters)
            if (config.features.allowLegacyAttributes) {
                this.initLegacyDisplays()
            }

            // Initialize each getter
            this.getterElements.forEach((getter) => this.initGetter(getter))

            return this
        }

        /**
         * Initialize legacy display elements (convert to getters)
         */
        initLegacyDisplays() {
            const displayElements = Array.from(
                this.calculator.container.querySelectorAll(
                    '[data-alphacalc-display]'
                )
            )

            displayElements.forEach((element) => {
                const cellId = element.getAttribute('data-alphacalc-display')

                // Only convert if not already a getter
                if (
                    !element.hasAttribute('data-alphacalc-output') &&
                    !element.hasAttribute('data-alphacalc-from')
                ) {
                    element.setAttribute('data-alphacalc-output', cellId)

                    // Add to getters if not already included
                    if (!this.getterElements.includes(element)) {
                        this.getterElements.push(element)
                    }

                    // Show deprecation warning if enabled
                    if (
                        this.calculator.config.features.showDeprecationWarnings
                    ) {
                        this.calculator.debugLog(
                            'Deprecated: data-alphacalc-display is deprecated. ' +
                                'Use data-alphacalc-output instead.',
                            element
                        )
                    }
                }
            })

            // Show deprecation warnings for data-alphacalc-from
            if (this.calculator.config.features.showDeprecationWarnings) {
                const fromElements = Array.from(
                    this.calculator.container.querySelectorAll(
                        '[data-alphacalc-from]'
                    )
                )

                fromElements.forEach((element) => {
                    this.calculator.debugLog(
                        'Deprecated: data-alphacalc-from is deprecated. ' +
                            'Use data-alphacalc-output instead.',
                        element
                    )
                })
            }
        }

        /**
         * Initialize a single getter element
         */
        initGetter(getter) {
            // Get the source ID from either the new or legacy attribute
            const sourceId = getter.hasAttribute('data-alphacalc-output')
                ? getter.getAttribute('data-alphacalc-output')
                : getter.getAttribute('data-alphacalc-from')

            if (!sourceId) {
                this.calculator.debugLog(
                    'Getter missing source attribute',
                    getter
                )
                return
            }

            // Determine if input or display element
            const isInput =
                getter.tagName === 'INPUT' ||
                getter.tagName === 'TEXTAREA' ||
                getter.tagName === 'SELECT'

            // Enhanced formula detection - check for both = prefix and math operators
            const mathPattern = /[\+\-\*\/\(\)%]/
            const hasFormula =
                sourceId.startsWith('=') || mathPattern.test(sourceId)

            // Store metadata for later use
            getter._alphaCalcGetterInfo = {
                sourceId,
                isInput,
                isFormula: hasFormula, // Use enhanced detection
            }

            // If formula getter, register with formula engine
            if (getter._alphaCalcGetterInfo.isFormula) {
                const cellId = this.calculator.inputManager.getCellId(getter)
                if (cellId) {
                    this.calculator.inputManager.formulaInputs.push(getter)

                    // Add debug logging
                    if (this.calculator.config.features.debug) {
                        this.calculator.debugLog(
                            `Registered formula input: ${cellId} with formula: ${sourceId}`,
                            { isExplicitFormula: sourceId.startsWith('=') }
                        )
                    }

                    // Make input read-only for formula getters
                    if (isInput && getter.tagName === 'INPUT') {
                        getter.readOnly = true
                    }
                }
            }

            // Handle bidirectional binding for inputs
            if (
                isInput &&
                getter.hasAttribute('data-alphacalc-bidirectional') &&
                getter.getAttribute('data-alphacalc-bidirectional') === 'true'
            ) {
                this.attachBidirectionalListener(getter)
            }

            // Listen for value changes
            this.calculator.events.on('value:changed', ({ cellId }) => {
                if (
                    cellId === sourceId ||
                    getter._alphaCalcGetterInfo.isFormula
                ) {
                    this.updateGetter(getter)
                }
            })

            // Initial update
            this.updateGetter(getter)
        }

        /**
         * Attach change listener for bidirectional getters
         */
        attachBidirectionalListener(getter) {
            const listener = () => {
                const sourceId = getter._alphaCalcGetterInfo.sourceId
                if (sourceId.startsWith('=')) return // Can't set formula getters

                // Get new value and update source
                const newValue = Util.parseNumeric(getter.value)
                this.calculator.inputManager.setValue(sourceId, newValue)

                // Trigger calculation
                if (this.calculator.config.features.autoCalculate) {
                    this.calculator.debouncedCalculate()
                }
            }

            getter.addEventListener('change', listener)
            this.listeners.set(getter, listener)
        }

        /**
         * Update a getter element with current value
         */
        updateGetter(getter) {
            if (!getter._alphaCalcGetterInfo) return

            const { sourceId, isInput, isFormula } = getter._alphaCalcGetterInfo
            let value = 0

            // Get value based on source type
            if (isFormula) {
                // For formula getters, evaluate the formula
                const formula = sourceId.substring(1) // Remove = prefix
                value = this.calculator.formulaEngine.evaluate(
                    formula,
                    Object.fromEntries(this.calculator.inputManager.inputValues)
                )
            } else {
                // For regular getters, lookup the value
                value =
                    this.calculator.inputManager.inputValues.get(sourceId) || 0
            }

            // Apply min/max constraints if present
            value = this.calculator.inputManager.clampValue(value, getter)

            // Get formatting options
            const decimals = getter.hasAttribute('data-alphacalc-decimals')
                ? parseInt(getter.getAttribute('data-alphacalc-decimals'))
                : this.calculator.config.decimal.display

            // Format based on element type
            if (isInput) {
                const isNumberInput =
                    getter.tagName === 'INPUT' &&
                    getter.getAttribute('type') === 'number'

                // For number inputs, use raw value
                if (isNumberInput) {
                    getter.value = value
                } else {
                    // For other inputs, use formatted value
                    getter.value = Util.formatNumber(value, { decimals })
                }
            } else {
                // For display elements, use formatted value
                getter.textContent = Util.formatNumber(value, { decimals })
            }

            // Register value in inputValues if this getter has an input ID
            const cellId = this.calculator.inputManager.getCellId(getter)
            if (cellId) {
                this.calculator.inputManager.inputValues.set(cellId, value)
            }
        }

        /**
         * Show active class on getter elements that have the attribute
         */
        showActiveClass() {
            this.getterElements.forEach((getter) => {
                if (getter.hasAttribute('data-alphacalc-classactive')) {
                    const activeClass =
                        getter.getAttribute('data-alphacalc-classactive') ||
                        'is-active'
                    getter.classList.add(activeClass)
                }
            })

            return this
        }

        /**
         * Hide active class on getter elements
         */
        hideActiveClass() {
            this.getterElements.forEach((getter) => {
                if (getter.hasAttribute('data-alphacalc-classactive')) {
                    const activeClass =
                        getter.getAttribute('data-alphacalc-classactive') ||
                        'is-active'
                    getter.classList.remove(activeClass)
                }
            })

            return this
        }

        /**
         * Clean up event listeners
         */
        destroy() {
            this.listeners.forEach((listener, getter) => {
                getter.removeEventListener('change', listener)
            })

            this.listeners.clear()
            this.getterElements = []

            return this
        }
    }

    /**
     * Group Manager - Handles input groups
     */
    class GroupManager {
        constructor(calculator) {
            this.calculator = calculator
            this.groups = new Map()
        }

        /**
         * Initialize all groups
         */
        init() {
            const { container } = this.calculator

            // Find all elements with group attribute
            const groupElements = Array.from(
                container.querySelectorAll('[data-alphacalc-group]')
            )

            // Process elements by group
            const groupMap = new Map()

            groupElements.forEach((element) => {
                const groupName = element.getAttribute('data-alphacalc-group')
                if (!groupName) return

                const cellId = this.calculator.inputManager.getCellId(element)
                if (!cellId) {
                    this.calculator.debugLog(
                        'Group element missing cell ID',
                        element
                    )
                    return
                }

                if (!groupMap.has(groupName)) {
                    groupMap.set(groupName, [])
                }

                groupMap.get(groupName).push(element)
            })

            // Create group objects
            groupMap.forEach((elements, groupName) => {
                this.createGroup(groupName, elements)
            })

            return this
        }

        /**
         * Create a group from elements
         */
        createGroup(groupName, elements) {
            // Check if it's a radio-only group
            const allRadios = elements.every(
                (el) =>
                    this.calculator.inputManager.getElementType(el) === 'radio'
            )

            const sameName =
                allRadios &&
                elements.every((el) => el.name === elements[0].name)

            const isRadioGroup = allRadios && sameName

            // Create group object
            this.groups.set(groupName, {
                name: groupName,
                elements,
                isRadioGroup,
                value: 0,
            })

            // Calculate initial value
            this.updateGroupValue(groupName)

            // Listen for value changes in group members
            elements.forEach((element) => {
                const cellId = this.calculator.inputManager.getCellId(element)

                this.calculator.events.on(
                    'value:changed',
                    ({ cellId: changedCellId }) => {
                        if (cellId === changedCellId) {
                            this.updateGroupValue(groupName)
                        }
                    }
                )
            })

            this.calculator.debugLog(
                `Group "${groupName}" initialized with ${elements.length} elements`
            )
        }

        /**
         * Update the value of a group
         */
        updateGroupValue(groupName) {
            if (!this.groups.has(groupName)) {
                this.calculator.debugLog(`Group "${groupName}" not found`)
                return
            }

            const group = this.groups.get(groupName)
            let groupValue = 0

            // Calculate value based on group type
            if (group.isRadioGroup) {
                // For radio groups, use value of checked radio
                const checkedRadio = group.elements.find((el) => el.checked)
                if (checkedRadio) {
                    groupValue =
                        this.calculator.inputManager.getElementValue(
                            checkedRadio
                        )
                }
            } else {
                // For other groups, sum all values
                groupValue = group.elements.reduce((sum, element) => {
                    const elementType =
                        this.calculator.inputManager.getElementType(element)

                    if (elementType === 'radio' || elementType === 'checkbox') {
                        // Only add if checked
                        return element.checked
                            ? sum +
                                  this.calculator.inputManager.getElementValue(
                                      element
                                  )
                            : sum
                    } else {
                        // Always add for regular inputs
                        return (
                            sum +
                            this.calculator.inputManager.getElementValue(
                                element
                            )
                        )
                    }
                }, 0)
            }

            // Store the group value
            group.value = groupValue

            // Also store in inputValues so formulas can reference it
            this.calculator.inputManager.inputValues.set(groupName, groupValue)

            // Emit event
            this.calculator.events.emit('value:changed', {
                cellId: groupName,
                value: groupValue,
            })

            this.calculator.debugLog(
                `Group "${groupName}" updated with value ${groupValue}`
            )
        }

        /**
         * Get a group's value
         */
        getGroupValue(groupName) {
            return this.groups.has(groupName)
                ? this.groups.get(groupName).value
                : 0
        }

        /**
         * Get all elements in a group
         */
        getGroupElements(groupName) {
            return this.groups.has(groupName)
                ? this.groups.get(groupName).elements
                : []
        }

        /**
         * Get active elements in a group
         */
        getGroupActiveElements(groupName) {
            if (!this.groups.has(groupName)) return []

            const group = this.groups.get(groupName)

            return group.elements.filter((element) => {
                const elementType =
                    this.calculator.inputManager.getElementType(element)
                return elementType === 'radio' || elementType === 'checkbox'
                    ? element.checked
                    : true
            })
        }

        /**
         * Check if a group is a radio group
         */
        isRadioGroup(groupName) {
            return this.groups.has(groupName)
                ? this.groups.get(groupName).isRadioGroup
                : false
        }
    }

    /**
     * SetterManager - Handles elements that set values
     *
     * Responsible for managing setter elements (elements that set values when clicked):
     * - Finding and tracking elements with data-alphacalc-set attribute
     * - Setting up click handlers to update values
     * - Supporting setting values to both inputs and groups
     * - Managing radio groups and selection state
     *
     * Setters provide an easy way to update calculator values through UI interactions.
     *
     * @class
     */
    class SetterManager {
        constructor(calculator) {
            this.calculator = calculator
            this.setters = []
            this.listeners = new Map()
        }

        /**
         * Initialize setters
         */
        init() {
            const { container, config } = this.calculator

            // Find all setter elements
            this.setters = Array.from(
                container.querySelectorAll(config.selectors.setter)
            )

            // Initialize each setter
            this.setters.forEach((setter) => this.initSetter(setter))

            return this
        }

        /**
         * Initialize a single setter
         */
        initSetter(setter) {
            const targetId = setter.getAttribute('data-alphacalc-set')
            const setValue = setter.getAttribute('data-alphacalc-value')

            if (!targetId || setValue === null) {
                this.calculator.debugLog(
                    'Setter missing required attributes',
                    setter
                )
                return
            }

            // Create click listener
            const listener = (e) => {
                e.preventDefault()

                // Set the value
                this.setValue(targetId, setValue)

                // Trigger calculation if needed
                if (this.calculator.config.features.autoCalculate) {
                    this.calculator.debouncedCalculate()
                }
            }

            // Attach listener
            setter.addEventListener('click', listener)
            this.listeners.set(setter, listener)
        }

        /**
         * Set a value using a setter
         */
        setValue(targetId, setValue) {
            // Check if target is a group
            if (this.calculator.groupManager.groups.has(targetId)) {
                this.setGroupValue(targetId, setValue)
                return
            }

            // Normal case: set cell value
            const numericValue = Util.parseNumeric(setValue)
            this.calculator.inputManager.setValue(targetId, numericValue)
        }

        /**
         * Set value for a group
         */
        setGroupValue(groupName, setValue) {
            const group = this.calculator.groupManager.groups.get(groupName)

            // Handle radio groups specially
            if (group.isRadioGroup) {
                // Find the radio with matching value
                const targetRadio = group.elements.find((element) => {
                    // Get value (custom or default)
                    const elementValue = element.hasAttribute(
                        'data-alphacalc-value'
                    )
                        ? element.getAttribute('data-alphacalc-value')
                        : element.value

                    // Match by value or numeric equivalent
                    return (
                        elementValue === setValue ||
                        Math.abs(
                            Util.parseNumeric(elementValue) -
                                Util.parseNumeric(setValue)
                        ) < 0.001
                    )
                })

                if (targetRadio) {
                    // Select this radio
                    targetRadio.checked = true
                    targetRadio.dispatchEvent(
                        new Event('change', { bubbles: true })
                    )
                } else {
                    this.calculator.debugLog(
                        `No radio with value ${setValue} found in group ${groupName}`
                    )
                }
            } else {
                this.calculator.debugLog(
                    `Setting values for non-radio groups not fully implemented`
                )
            }
        }

        /**
         * Clean up event listeners
         */
        destroy() {
            this.listeners.forEach((listener, setter) => {
                setter.removeEventListener('click', listener)
            })

            this.listeners.clear()
            this.setters = []

            return this
        }
    }

    /**
     * SubmitManager - Handles submit buttons and form submission
     *
     * Responsible for managing submission-related functionality:
     * - Finding and tracking submit buttons within the calculator
     * - Finding and handling all forms related to the calculator (descendants and ancestors)
     * - Setting up click handlers to trigger calculations
     * - Preventing default form submission behavior unless explicitly allowed
     * - Respecting data-alphacalc-allowsubmit attribute for forms and calculator
     *
     * Submit elements allow users to manually trigger calculations when autoCalculate
     * is disabled or when explicit calculation is preferred.
     *
     * @class
     */
    class SubmitManager {
        constructor(calculator) {
            this.calculator = calculator
            this.submitElements = []
            this.forms = [] // Track all related forms
            this.listeners = new Map()
        }

        /**
         * Initialize submit elements and form handling
         */
        init() {
            const { container, config } = this.calculator

            // Find all submit elements
            this.submitElements = Array.from(
                container.querySelectorAll(config.selectors.submit)
            )

            // Initialize each submit element
            this.submitElements.forEach((element) => {
                const listener = (e) => {
                    // Check if this is specifically marked as a form submit button
                    const isFormSubmitButton =
                        element.hasAttribute('data-alphacalc-formsubmit') &&
                        element.getAttribute('data-alphacalc-formsubmit') ===
                            'true'

                    // If inside a form, check if we should prevent submission
                    const parentForm = element.closest('form')
                    if (
                        parentForm &&
                        !isFormSubmitButton &&
                        !this.isFormSubmitAllowed(parentForm)
                    ) {
                        e.preventDefault()
                    }

                    // Always run the calculation
                    this.calculator.debouncedCalculate()

                    // For explicitly marked form submit buttons, we might need a small delay
                    // to ensure calculations complete before the form submits
                    if (isFormSubmitButton && parentForm) {
                        // We don't prevent default for these buttons, so form will submit naturally
                        this.calculator.debugLog(
                            'Form submit button clicked, form will submit after calculation'
                        )
                    }
                }

                element.addEventListener('click', listener)
                this.listeners.set(element, listener)
            })

            // Find and handle all related forms
            this.handleRelatedForms()

            return this
        }

        /**
         * Find and handle all forms related to the calculator
         */
        handleRelatedForms() {
            const { container } = this.calculator

            // Case 1: Container itself is a form
            if (container.tagName.toLowerCase() === 'form') {
                this.forms.push(container)
            }

            // Case 2: Find all descendant forms
            const childForms = Array.from(container.querySelectorAll('form'))
            this.forms.push(...childForms)

            // Case 3: Find ancestor form(s)
            let parent = container.parentElement
            while (parent) {
                if (parent.tagName.toLowerCase() === 'form') {
                    this.forms.push(parent)
                }
                parent = parent.parentElement
            }

            // Remove duplicates
            this.forms = [...new Set(this.forms)]

            // Add submit listeners to all forms
            this.forms.forEach((form) => {
                const formListener = (e) => {
                    if (!this.isFormSubmitAllowed(form)) {
                        e.preventDefault()
                        this.calculator.debouncedCalculate()
                    }
                }

                form.addEventListener('submit', formListener)
                this.listeners.set(form, formListener)
            })

            this.calculator.debugLog(
                `Found and handled ${this.forms.length} related forms`
            )
        }

        /**
         * Check if form submission should be allowed
         */
        isFormSubmitAllowed(form) {
            if (!form) return false

            // Check form-specific override
            if (form.hasAttribute('data-alphacalc-allowsubmit')) {
                return (
                    form.getAttribute('data-alphacalc-allowsubmit') === 'true'
                )
            }

            // Check calculator-wide override
            if (
                this.calculator.container.hasAttribute(
                    'data-alphacalc-allowsubmit'
                )
            ) {
                return (
                    this.calculator.container.getAttribute(
                        'data-alphacalc-allowsubmit'
                    ) === 'true'
                )
            }

            // Default: prevent submission
            return false
        }

        /**
         * Clean up event listeners
         */
        destroy() {
            this.listeners.forEach((listener, element) => {
                const eventType =
                    element.tagName.toLowerCase() === 'form'
                        ? 'submit'
                        : 'click'
                element.removeEventListener(eventType, listener)
            })

            this.listeners.clear()
            this.submitElements = []
            this.forms = []

            return this
        }
    }

    /**
     * LoadingManager - Handles loading indicators
     *
     * Responsible for managing loading indicator elements within the calculator:
     * - Finding and tracking loading elements with data-alphacalc-element="loading"
     * - Showing/hiding loading indicators during debounced calculations
     * - Toggling active classes on loading elements
     *
     * @class
     */
    class LoadingManager {
        constructor(calculator) {
            this.calculator = calculator
            this.loadingElements = []
        }

        /**
         * Initialize loading elements
         */
        init() {
            const { container, config } = this.calculator

            // Find all loading elements
            this.loadingElements = Array.from(
                container.querySelectorAll(config.selectors.loading)
            )

            this.calculator.debugLog(
                `Found ${this.loadingElements.length} loading elements`
            )

            return this
        }

        /**
         * Show loading indicators
         */
        showLoading() {
            this.loadingElements.forEach((element) => {
                const activeClass =
                    element.getAttribute('data-alphacalc-classactive') ||
                    'is-active'
                element.classList.add(activeClass)
            })

            return this
        }

        /**
         * Hide loading indicators
         */
        hideLoading() {
            this.loadingElements.forEach((element) => {
                const activeClass =
                    element.getAttribute('data-alphacalc-classactive') ||
                    'is-active'
                element.classList.remove(activeClass)
            })

            return this
        }

        /**
         * Clean up
         */
        destroy() {
            // Ensure all loading indicators are hidden
            this.hideLoading()
            this.loadingElements = []

            return this
        }
    }

    /**
     * Main AlphaCalc class
     *
     * The primary class that coordinates all calculator functionality.
     * It initializes and manages specialized components to handle different aspects
     * of the calculator's operation.
     *
     * Key responsibilities:
     * - Setting up and configuring the calculator
     * - Coordinating between specialized managers
     * - Handling top-level events and calculations
     * - Providing public API methods for external interaction
     * - Managing debug and logging functionality
     *
     * @class
     */
    class AlphaCalc {
        constructor(container, options = {}) {
            if (!container) {
                throw new Error(
                    'AlphaCalc: A valid container element is required.'
                )
            }

            this.container = container

            // Get calculator name
            this.name =
                container.getAttribute('data-alphacalc-calculator') || 'unnamed'

            // Merge config options
            this.config = Util.mergeDeep({}, DEFAULT_CONFIG, options)

            // Get debounce time from attribute if provided
            const debounceAttr = container.getAttribute(
                'data-alphacalc-debounce'
            )
            if (debounceAttr && !isNaN(parseInt(debounceAttr))) {
                this.config.features.debounceTime = parseInt(debounceAttr)
            }

            // Setup debug mode
            if (typeof options.debug === 'undefined') {
                const isWebflow =
                    window.location.hostname.includes('webflow.io')
                const devQuery =
                    new URLSearchParams(window.location.search).get('dev') ===
                    'true'
                this.config.features.debug = isWebflow || devQuery
            }

            // Create event bus
            this.events = new EventBus()

            // Create sub-managers
            this.inputManager = new InputManager(this)
            this.formulaEngine = new FormulaEngine(this)
            this.outputManager = new OutputManager(this)
            this.groupManager = new GroupManager(this)
            this.setterManager = new SetterManager(this)
            this.submitManager = new SubmitManager(this)
            this.loadingManager = new LoadingManager(this)

            // Custom calculation functions
            this.calculations = []

            // Create enhanced debounced calculate method with loading indicators
            this.debouncedCalculate = (() => {
                let timeout = null

                return () => {
                    // Show loading indicators
                    this.loadingManager.showLoading()
                    // Show active class on getters that have the attribute
                    this.outputManager.showActiveClass()

                    // Clear previous timeout
                    if (timeout) {
                        clearTimeout(timeout)
                    }

                    // Set new timeout with configurable delay
                    timeout = setTimeout(() => {
                        this.calculate()

                        // Additional small delay to ensure updates are visible before removing indicators
                        setTimeout(() => {
                            // Hide loading indicators when calculation completes
                            this.loadingManager.hideLoading()
                            // Remove active class from getters after calculations
                            this.outputManager.hideActiveClass()
                        }, 50) // Small delay to ensure UI updates have completed
                    }, this.config.features.debounceTime)
                }
            })()

            // Initialize components
            this.initialize()

            // Log initialization
            this.debugLog(
                `Calculator initialized with debounce time: ${this.config.features.debounceTime}ms`
            )

            return this
        }

        /**
         * Initialize all components
         */
        initialize() {
            // Initialize all managers
            this.inputManager.init()
            this.groupManager.init()
            this.outputManager.init()
            this.setterManager.init()
            this.submitManager.init()
            this.loadingManager.init()

            // If in debug mode, add name guides
            if (this.config.features.debug) {
                this.initNameGuides()
            }

            // Initial calculation
            this.calculate()

            return this
        }

        /**
         * Perform all calculations
         *
         * Evaluates all formulas, updates input values, and refreshes displays.
         * This is the core method that drives the calculator's functionality.
         *
         * The calculation process:
         * 1. Processes all formula inputs
         * 2. Updates all display elements
         * 3. Runs any custom calculation functions
         * 4. Logs debug information if enabled
         *
         * @returns {AlphaCalc} This instance for chaining
         */
        calculate() {
            // Debug: Show number of formula inputs found
            this.debugLog(
                `Processing ${this.inputManager.formulaInputs.length} formula inputs`
            )

            // Test regex patterns
            if (this.config.features.debug) {
                this.debugLog('Formula detection test: ', {
                    'A1 * B1': /[\+\-\*\/\(\)%]/.test('A1 * B1'),
                    'A1+B1': /[\+\-\*\/\(\)%]/.test('A1+B1'),
                    'N1 * CG10': /[\+\-\*\/\(\)%]/.test('N1 * CG10'),
                })
            }

            // Process all formula inputs
            this.inputManager.formulaInputs.forEach((input) => {
                const cellId = this.inputManager.getCellId(input)
                if (!cellId) {
                    this.debugLog(
                        'Skipping formula input: No cell ID found',
                        input
                    )
                    return
                }

                let formula = null
                let computedValue = 0
                let formulaSource = ''

                // Debug input details
                if (this.config.features.debug) {
                    this.debugLog(`Processing input ${cellId}`, {
                        hasFormula: input.hasAttribute(
                            'data-alphacalc-formula'
                        ),
                        hasOutput: input.hasAttribute('data-alphacalc-output'),
                        hasFrom: input.hasAttribute('data-alphacalc-from'),
                        element: input,
                    })
                }

                // Get formula from appropriate attribute
                if (input.hasAttribute('data-alphacalc-formula')) {
                    formula = input.getAttribute('data-alphacalc-formula')
                    formulaSource = 'formula-attribute'
                    this.debugLog(
                        `Found formula via data-alphacalc-formula: ${formula}`
                    )
                } else if (
                    input.hasAttribute('data-alphacalc-output') ||
                    input.hasAttribute('data-alphacalc-from')
                ) {
                    // Check both new and legacy attributes
                    const attrName = input.hasAttribute('data-alphacalc-output')
                        ? 'data-alphacalc-output'
                        : 'data-alphacalc-from'

                    const attrValue = input.getAttribute(attrName)

                    if (!attrValue) {
                        this.debugLog(`Empty ${attrName} attribute`, input)
                        return
                    }

                    this.debugLog(
                        `Processing ${attrName} value: "${attrValue}"`
                    )

                    // Check if it starts with equals sign (explicit formula)
                    if (attrValue.startsWith('=')) {
                        formula = attrValue.substring(1)
                        formulaSource = 'equals-prefix'
                        this.debugLog(
                            `Found formula via equals prefix: ${formula}`
                        )
                    } else {
                        // Auto-detect formula - check if it contains math operators
                        const mathPattern = /[\+\-\*\/\(\)%]/

                        // Log detection attempt
                        this.debugLog(
                            `Testing for formula operators in: "${attrValue}"`
                        )
                        this.debugLog(
                            `Contains operators: ${mathPattern.test(attrValue)}`
                        )

                        if (mathPattern.test(attrValue)) {
                            formula = attrValue
                            formulaSource = 'auto-detected'
                            this.debugLog(
                                `Auto-detected formula without = prefix: ${formula}`
                            )
                        } else {
                            this.debugLog(
                                `Not a formula, treating as reference: ${attrValue}`
                            )
                            return
                        }
                    }
                } else {
                    this.debugLog(
                        `No formula attributes found for ${cellId}`,
                        input
                    )
                    return
                }

                // If we found a formula, evaluate it
                if (formula) {
                    this.debugLog(
                        `Evaluating formula (${formulaSource}): ${formula}`
                    )

                    // Get all current values
                    const inputValues = Object.fromEntries(
                        this.inputManager.inputValues
                    )

                    // Debug: show available values for formula
                    if (this.config.features.debug) {
                        this.debugLog(
                            'Available values for formula:',
                            inputValues
                        )
                    }

                    // Evaluate the formula
                    try {
                        computedValue = this.formulaEngine.evaluate(
                            formula,
                            inputValues
                        )
                        this.debugLog(
                            `Formula result: ${formula} = ${computedValue}`
                        )

                        // Update the element value
                        this.inputManager.setValue(cellId, computedValue)
                    } catch (error) {
                        this.debugLog(
                            `Error evaluating formula ${formula}:`,
                            error
                        )
                    }
                }
            })

            // Run any custom calculations
            this.calculations.forEach((fn, index) => {
                try {
                    this.debugLog(
                        `Running custom calculation function #${index + 1}`
                    )
                    fn(this.inputManager.inputValues, this.container)
                } catch (error) {
                    this.debugLog(
                        `Error in custom calculation function #${index + 1}:`,
                        error
                    )
                }
            })

            // Log debug information if enabled
            if (this.config.features.debug) {
                this.logDebugInfo()
            }

            return this
        }

        /**
         * Initialize name guides on labels (debug feature)
         */
        initNameGuides() {
            this.container.querySelectorAll('label').forEach((label) => {
                // Find associated input
                const element =
                    label.querySelector('input') ||
                    label.querySelector('select') ||
                    label.querySelector('input[type="radio"]') ||
                    label.querySelector('input[type="checkbox"]')

                if (!element) return

                // Get cell ID
                const cellId = this.inputManager.getCellId(element)
                if (cellId) {
                    // Add name guide attribute
                    label.setAttribute('data-alphacalc-nameguide', cellId)
                }
            })

            this.debugLog('Name guides initialized on labels.')
        }

        /**
         * Log debug information
         */
        logDebugInfo() {
            // Prepare data for inputs
            const inputData = Array.from(
                this.inputManager.inputValues.entries()
            )
                .map(([cellId, value]) => {
                    // Get element
                    const element = this.inputManager.inputElements.get(cellId)

                    // Skip if no element (might be a group)
                    if (!element) return null

                    // Get element details
                    const elementType =
                        this.inputManager.getElementType(element)
                    const name = element.getAttribute('data-name') || ''
                    const formula = element.hasAttribute(
                        'data-alphacalc-formula'
                    )
                        ? element.getAttribute('data-alphacalc-formula')
                        : ''
                    const group = element.hasAttribute('data-alphacalc-group')
                        ? element.getAttribute('data-alphacalc-group')
                        : ''
                    const isActive =
                        elementType === 'radio' || elementType === 'checkbox'
                            ? element.checked
                            : true

                    return {
                        Cell: cellId,
                        Name: name,
                        Type: elementType.toUpperCase(),
                        Group: group || '-',
                        Value: value,
                        Active: isActive ? '✓' : '❌',
                        Formula: formula || '-',
                    }
                })
                .filter(Boolean)

            // Prepare data for groups
            const groupData = Array.from(
                this.groupManager.groups.entries()
            ).map(([groupName, group]) => ({
                Group: groupName,
                Type: group.isRadioGroup ? 'Radio' : 'Mixed',
                Value: group.value,
                Elements: group.elements.length,
                Active: this.groupManager.getGroupActiveElements(groupName)
                    .length,
            }))

            // Enhanced getter data with calculated values
            const getterData = this.outputManager.getterElements
                .map((getter) => {
                    if (!getter._alphaCalcGetterInfo) return null

                    const { sourceId, isInput, isFormula } =
                        getter._alphaCalcGetterInfo
                    const id =
                        getter.id ||
                        (getter.name ? `name="${getter.name}"` : getter.tagName)

                    // Get the displayed value
                    let displayedValue = ''
                    if (isInput) {
                        displayedValue = getter.value
                    } else {
                        displayedValue = getter.textContent
                    }

                    // Get the source value
                    let sourceValue = ''
                    if (isFormula) {
                        // For formula getters, use the formula result
                        const formula = sourceId.substring(1) // Remove = prefix
                        sourceValue = this.formulaEngine.evaluate(
                            formula,
                            Object.fromEntries(this.inputManager.inputValues)
                        )
                    } else {
                        // For regular getters, use the value from inputValues
                        sourceValue =
                            this.inputManager.inputValues.get(sourceId) || 0
                    }

                    // Determine which attribute is used
                    let attributeUsed = getter.hasAttribute(
                        'data-alphacalc-output'
                    )
                        ? 'output'
                        : getter.hasAttribute('data-alphacalc-from')
                        ? 'from'
                        : 'display'

                    return {
                        Element: id,
                        Type: getter.tagName,
                        Source: sourceId,
                        Attribute: attributeUsed,
                        Formula: isFormula ? 'YES' : 'NO',
                        SourceValue: sourceValue,
                        DisplayedValue: displayedValue,
                        Decimals: getter.hasAttribute('data-alphacalc-decimals')
                            ? getter.getAttribute('data-alphacalc-decimals')
                            : this.config.decimal.display,
                    }
                })
                .filter(Boolean)

            // Log tables
            const caption = `AlphaCalc [${this.name}]`
            console.group(caption)

            console.log('Inputs:')
            console.table(inputData)

            if (groupData.length > 0) {
                console.log('Groups:')
                console.table(groupData)
            }

            if (getterData.length > 0) {
                console.log('Outputs:')
                console.table(getterData)
            }

            console.groupEnd()
        }

        /**
         * Log debug message if debug mode is enabled
         */
        debugLog(message, data = null) {
            if (!this.config.features.debug) return

            const prefix = `AlphaCalc [${this.name}]: `

            if (data) {
                console.log(`${prefix}${message}`, data)
            } else {
                console.log(`${prefix}${message}`)
            }
        }

        /**
         * Add a custom calculation function
         */
        addCalculation(fn) {
            if (typeof fn === 'function') {
                this.calculations.push(fn)
            }

            return this
        }

        /**
         * Reinitialize the calculator
         */
        reinit() {
            this.destroy()
            this.initialize()
            this.debugLog('Calculator reinitialized')

            return this
        }

        /**
         * Clean up and remove event listeners
         */
        destroy() {
            // Clean up all managers
            this.inputManager.destroy()
            this.outputManager.destroy()
            this.setterManager.destroy()
            this.submitManager.destroy()
            this.loadingManager.destroy()

            // Clear calculations
            this.calculations = []

            this.debugLog('Calculator destroyed')

            return this
        }

        /**
         * Set a value programmatically
         */
        setValue(cellId, value) {
            this.inputManager.setValue(cellId, value)
            return this
        }

        /**
         * Get a value
         */
        getValue(cellId) {
            return this.inputManager.inputValues.get(cellId) || 0
        }

        /**
         * Get all values as an object
         */
        getAllValues() {
            return Object.fromEntries(this.inputManager.inputValues)
        }
    }

    /**
     * Static methods and properties
     */

    // Global configuration that applies to all instances
    AlphaCalc.globalConfig = {}

    // Collection of all calculator instances
    AlphaCalc.instances = []

    /**
     * Get a calculator instance by name
     */
    AlphaCalc.getByName = function (name) {
        return AlphaCalc.instances.find(
            (calc) => calc.name.toLowerCase() === name.toLowerCase()
        )
    }

    /**
     * Get all calculator instances
     */
    AlphaCalc.getAllInstances = function () {
        return [...AlphaCalc.instances]
    }

    /**
     * Calculate all calculators
     */
    AlphaCalc.calculateAll = function () {
        AlphaCalc.instances.forEach((calc) => calc.calculate())
    }

    /**
     * Initialize all calculators on the page
     */
    AlphaCalc.initAll = function (options = {}) {
        // Find all calculator containers
        const calculators = document.querySelectorAll(
            '[data-alphacalc-calculator]'
        )
        const legacyCalculators = document.querySelectorAll(
            '[data-alphacalc-element="calculator"]:not([data-alphacalc-calculator])'
        )

        // Combine both sets
        const allCalculators = [...calculators, ...legacyCalculators]

        if (allCalculators.length === 0) {
            console.log('AlphaCalc: No calculators found on the page.')
            return
        }

        console.log(
            `AlphaCalc: Found ${allCalculators.length} calculator(s) on the page.`
        )

        // Clean up any existing instances
        AlphaCalc.instances.forEach((calc) => calc.destroy())
        AlphaCalc.instances = []

        // Initialize each calculator
        allCalculators.forEach((container) => {
            // Get container-specific options
            const containerOptions = {}

            // Override options via custom attributes
            if (container.hasAttribute('data-alphacalc-debug')) {
                containerOptions.features = containerOptions.features || {}
                containerOptions.features.debug =
                    container.getAttribute('data-alphacalc-debug') === 'true'
            }

            if (container.hasAttribute('data-alphacalc-defaultfromdecimals')) {
                containerOptions.decimal = containerOptions.decimal || {}
                containerOptions.decimal.display = parseInt(
                    container.getAttribute('data-alphacalc-defaultfromdecimals')
                )
            }

            if (container.hasAttribute('data-alphacalc-defaultinputdecimals')) {
                containerOptions.decimal = containerOptions.decimal || {}
                containerOptions.decimal.input = parseInt(
                    container.getAttribute(
                        'data-alphacalc-defaultinputdecimals'
                    )
                )
            }

            // Merge global options with container options
            const mergedOptions = Util.mergeDeep({}, options, containerOptions)

            // Create new instance
            const calculator = new AlphaCalc(container, mergedOptions)

            // Add to instances collection
            AlphaCalc.instances.push(calculator)
        })

        return AlphaCalc.instances
    }

    /**
     * Initialize a specific container
     */
    AlphaCalc.init = function (container, options = {}) {
        if (!container) {
            console.error('AlphaCalc.init: No element provided')
            return null
        }

        const calculator = new AlphaCalc(container, options)
        AlphaCalc.instances.push(calculator)

        return calculator
    }

    // Auto-initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => AlphaCalc.initAll())
    } else {
        setTimeout(() => AlphaCalc.initAll(), 0)
    }

    // Listen for manual initialization request
    document.addEventListener('AlphaCalcReady', () => AlphaCalc.initAll())

    return AlphaCalc
})
