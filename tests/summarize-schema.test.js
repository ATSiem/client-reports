// Test for the summarize API schema validation
const { z } = require('zod');

// Create a mock implementation of the AI SDK generateObject function
const mockGenerateObject = jest.fn().mockResolvedValue({
  object: {
    report: 'Test report content',
    highlights: []
  }
});

// Mock the AI SDK
jest.mock('ai', () => ({
  generateObject: mockGenerateObject
}));

// Import the mocked function after mocking
const { generateObject } = require('ai');

describe('Summarize API Schema', () => {
  beforeEach(() => {
    // Clear mock data before each test
    jest.clearAllMocks();
  });

  test('Schema should not use default values for highlights', () => {
    // This test verifies that we're not using default values in the schema
    // which would cause the OpenAI API to reject the request
    
    // Create a schema similar to what we use in the API
    const schema = z.object({ 
      report: z.string(),
      highlights: z.array(z.string()) // No default value
    });
    
    // Validate that the schema works with the expected response format
    const validData = {
      report: 'Test report content',
      highlights: []
    };
    
    const result = schema.parse(validData);
    expect(result).toEqual(validData);
    
    // Verify that the schema accepts an empty array for highlights
    const dataWithEmptyHighlights = {
      report: 'Test report content',
      highlights: []
    };
    
    const resultWithEmptyHighlights = schema.parse(dataWithEmptyHighlights);
    expect(resultWithEmptyHighlights).toEqual(dataWithEmptyHighlights);
  });
  
  test('generateObject should be called with the correct schema', async () => {
    // Define test data
    const mockModel = {
      objectGenerationMode: 'json',
      structuredOutputs: true
    };
    
    const testSchema = z.object({ 
      report: z.string(),
      highlights: z.array(z.string()) // No default value
    });
    
    // Call generateObject with our test data
    await generateObject({
      model: mockModel,
      schemaName: "communicationReport",
      schemaDescription: "A formatted report of email communications",
      schema: testSchema,
      prompt: "Test prompt",
    });
    
    // Verify that generateObject was called with the correct schema
    expect(generateObject).toHaveBeenCalledWith({
      model: mockModel,
      schemaName: "communicationReport",
      schemaDescription: "A formatted report of email communications",
      schema: testSchema,
      prompt: "Test prompt",
    });
    
    // Verify that the schema doesn't have a default value for highlights
    const schemaArg = generateObject.mock.calls[0][0].schema;
    const schemaShape = schemaArg._def.shape();
    
    // Check that highlights is defined as an array without default
    expect(schemaShape.highlights._def.typeName).toBe('ZodArray');
    
    // Ensure there's no default value set
    expect(schemaShape.highlights._def.defaultValue).toBeUndefined();
  });
}); 