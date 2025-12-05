// Importing the McpServer class from the Model Context Protocol SDK
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// Importing the StdioServerTransport class for communication over standard input/output
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs/promises";
import { z } from "zod";
// Creating an instance of the MCP server with metadata
const server = new McpServer({
  name: "Example MCP Server", // Name of the server
  version: "1.0.0",           // Version of the server
});

//! Tools
server.tool(
  "create-user", // The unique identifier for the tool
  "Create a new user in the system", // A description of what the tool does
  {
    // Defining the parameters required by the tool
    name: z.string(), // A string parameter for the user's name
    email: z.string().email(), // A string parameter for the user's email, validated as an email
    address: z.string(), // A string parameter for the user's address
    phone: z.string(), // A string parameter for the user's phone number
  },
  {
    // Additional metadata about the tool
    title: "Create User Tool", // The title of the tool
    readOnlyHint: false, // Indicates that the tool modifies data
    destructiveHint: false, // Indicates that the tool is not destructive(deletes data)
    idempotentHint: false, // Indicates that the tool may produce different results if called multiple times
    openWorldHint: true, // Indicates that the tool interacts with external systems or data
  },
  async (params) => {
    // The implementation of the tool's functionality
    try {
      const id = await createUser(params); // Calls the helper function to create a user with the provided parameters

      return {
        content: [{ type: "text", text: `User ${id} created successfully` }], // Returns a success message with the user ID
      };
    } catch {
      return {
        content: [{ type: "text", text: "Failed to save user" }], // Returns an error message if user creation fails
      };
    }
  }
);

//? Helper function to simulate user creation
async function createUser(params: {
  name: string;
  email: string;
  address: string;
  phone: string;
}) {
  const users = await import("./data/users.json",
    { with: { type: "json" } })
    .then(m => m.default)

  const id = users.length + 1;
  users.push({ id, ...params });
  await fs.writeFile("./src/data/users.json", JSON.stringify(users, null, 2));
  return id;
}


// Main function to initialize and start the server
async function main() {
  // Creating a transport layer for communication using standard input/output
  const transport = new StdioServerTransport();

  // Connecting the server to the transport layer
  await server.connect(transport);
  console.error("Weather MCP Server running on stdio"); // Logging a message to indicate the server is running
}

// Calling the main function and handling any errors that occur
main().catch((err) => {
  console.error("Fatal error in main():", err); // Logging the error
  process.exit(1); // Exiting the process with a failure code
});