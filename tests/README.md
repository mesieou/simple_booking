# Tests Directory 🧪

This directory contains all automated tests for the Simple Booking application.

## 📁 Directory Structure

```
tests/
├── escalation/                    # 🚨 Escalation system tests (complete module)
│   ├── unit/                      # Unit tests for escalation components
│   ├── integration/               # Integration tests for escalation workflows
│   ├── flow/                      # End-to-end escalation scenarios
│   ├── utilities/                 # Test builders and helpers
│   ├── config/                    # Test configuration
│   └── docs/                      # Test documentation
├── README.md                      # This file
└── PHONE_NUMBER_SETUP.md          # Phone number setup for tests
```

## 🚨 Escalation Tests (Complete Module)

The escalation tests are fully organized into a comprehensive module with:

- **Unit Tests**: Individual component testing
- **Integration Tests**: System integration testing
- **Flow Tests**: Complete user journey testing
- **Utilities**: Test builders and helpers
- **Documentation**: Comprehensive test scenarios

### Running Escalation Tests

```bash
# All escalation tests
npm test tests/escalation/

# By test type
npm test tests/escalation/unit/
npm test tests/escalation/integration/
npm test tests/escalation/flow/

# Specific functionality
npm test tests/escalation/unit/proxy-session-manager.test.ts
npm test tests/escalation/integration/proxy-escalation.test.ts
```

For detailed escalation test documentation, see:
- **[Escalation Tests Overview](escalation/README.md)**
- **[Proxy Test Scenarios](escalation/docs/proxy-test-scenarios.md)**
- **[Complete Test List](escalation/docs/ESCALATION_TESTS_COMPLETE_LIST.md)**

## 🏗️ Other Modules (Future)

Other functional modules (booking, WhatsApp, FAQ, etc.) will be organized similarly when they reach sufficient complexity to warrant dedicated test modules.

## 📋 Test Standards

### Module Organization
- Each major functional area gets its own module
- Tests organized by type (unit, integration, flow)
- Comprehensive utilities and documentation
- Clear separation of concerns

### Test Types
- **Unit**: Fast, isolated component tests
- **Integration**: Component interaction tests
- **Flow**: Complete user journey tests
- **End-to-End**: Full system tests

### Best Practices
- Tests are independent and isolated
- Proper setup and teardown
- Mock external dependencies
- Clear test naming and documentation

## 🔧 Test Setup

### Prerequisites
- Node.js and npm installed
- Test database configured
- Environment variables set

### Environment Setup
See `PHONE_NUMBER_SETUP.md` for phone number configuration required for escalation tests.

### Running Tests
```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage

# Specific module
npm test tests/escalation/
```

## 📊 Test Coverage

| Module | Coverage Target | Status |
|--------|-----------------|--------|
| Escalation | 90%+ | ✅ Complete |
| Booking | 85%+ | 🚧 Future |
| WhatsApp | 90%+ | 🚧 Future |
| FAQ | 80%+ | 🚧 Future |
| User Management | 85%+ | 🚧 Future |

## 🤝 Contributing

### Adding New Tests
1. Follow the escalation module structure as a template
2. Organize tests by functionality, not just by type
3. Include comprehensive utilities and documentation
4. Maintain high test coverage

### Test File Naming
- Unit: `[component].test.ts`
- Integration: `[feature]-integration.test.ts`
- Flow: `[scenario]-flow.test.ts`
- End-to-End: `[workflow]-e2e.test.ts`

### Creating New Modules
When a functional area grows complex enough:
1. Create dedicated module directory
2. Organize by test type (unit, integration, flow)
3. Add utilities and configuration
4. Create comprehensive documentation
5. Update this README

---

For specific test details, see the documentation in each module's directory.
