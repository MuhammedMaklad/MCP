// Importing the McpServer class from the Model Context Protocol SDK
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
// Importing the StdioServerTransport class for communication over standard input/output
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CreateMessageResultSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import { text } from "stream/consumers";
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
//*----------------------------------------------------------------
//? Helper function to create a user and save their data to a file
async function createUser(params: {
  name: string;
  email: string;
  address: string;
  phone: string;
}) {
  const users = await import("./data/users.json", { with: { type: "json" } }).then((mod) => mod.default as any[]); // Importing existing users from a JSON file

  const id = users.length + 1; // Generating a new user ID based on the number of existing users
  users.push({ id, ...params }); // Adding the new user to the list

  await fs.writeFile("./src/data/users.json", JSON.stringify(users, null, 2));

  return id;
}

server.tool(
  "create-random-user",
  "Create a random user with fake data",
  {
    title: "Create Random User",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async () => {
    const res = await server.server.request(
      {
        method: "sampling/createMessage",
        params: {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "Generate fake user data. The user should have a realistic name, email, address, and phone number. Return this data as a JSON object with no other text or formatter so it can be used with JSON.parse.",
              },
            },
          ],
          maxTokens: 1024,
        },
      },
      CreateMessageResultSchema
    )

    if (res.content.type !== "text") {
      return {
        content: [{ type: "text", text: "Failed to generate user data" }],
      }
    }

    try {
      const fakeUser = JSON.parse(
        res.content.text
          .trim()
          .replace(/^```json/, "")
          .replace(/```$/, "")
          .trim()
      )

      const id = await createUser(fakeUser)
      return {
        content: [{ type: "text", text: `User ${id} created successfully` }],
      }
    } catch {
      return {
        content: [{ type: "text", text: "Failed to generate user data" }],
      }
    }
  }
)
//*----------------------------------------------------------------

server.resource(
  "Users", // The unique identifier for the resource
  "user://all", // The URI of the resource
  {
    // Metadata about the resource
    title: "Users", // The title of the resource
    description: "Get all users in database", // A description of what the resource provides
    mimeType: "application/json", // The MIME type of the resource, indicating it provides JSON data
  },
  async (uri) => {
    // The callback function to handle requests for this resource
    const users = await import("./data/users.json", { with: { type: "json" } })
      .then((mod) => mod.default as any[]); // Dynamically importing the users data from a JSON file

    return {
      contents: [
        {
          uri: uri.href, // The URI of the resource
          type: "application/json", // The MIME type of the resource
          text: JSON.stringify(users), // The content of the resource as a JSON string
        }
      ]
    };
  }
);

server.resource(
  "user-details", // The unique identifier for the resource
  new ResourceTemplate("users://{userId}/details", { list: undefined }), // The URI of the resource
  {
    // Metadata about the resource
    title: "User Details", // The title of the resource
    description: "Get details for a specific user by ID", // A description of what the resource provides
    mimeType: "application/json", // The MIME type of the resource, indicating it provides JSON data
  },
  async (uri, { userId }) => {
    // The callback function to handle requests for this resource

    const users = await import("./data/users.json", { with: { type: "json" } })
      .then((mod) => mod.default as any[]); // Dynamically importing the users data from a JSON file
    const user = users.find((u) => u.id === Number(userId)); // Finding the user with the specified ID

    if (user === null)
      return {
        contents: [
          {
            uri: uri.href, // The URI of the resource
            type: "application/json", // The MIME type of the resource
            text: JSON.stringify({ error: "User not found" }), // The content of the resource as a JSON string
          }
        ]
      };
    return {
      contents: [
        {
          uri: uri.href, // The URI of the resource
          type: "application/json", // The MIME type of the resource
          text: JSON.stringify(user), // The content of the resource as a JSON string
        }
      ]
    }
  }
)
//* ---------------------------------------------------------------
server.prompt(
  "generate-fake-user", // The unique identifier for the prompt
  "Generate a fake user profile", // A description of what the prompt does
  {
    // Defining the parameters required by the prompt
    name: z.string(), // An string parameter for the name of the fake user
  },
  ({ name }) => {
    // The implementation of the prompt's functionality
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Generate a detailed fake user profile for a person named ${name}, including age, address, email, and phone number.`,
          },
        }
      ]
    };
  }
)







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