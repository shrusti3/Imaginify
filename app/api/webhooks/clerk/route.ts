import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { createUser, updateUser, deleteUser } from "@/lib/actions/user.actions";

export async function POST(req: NextRequest) {
  try {
    // Clerk automatically verifies using CLERK_WEBHOOK_SIGNING_SECRET
    const evt = await verifyWebhook(req);
    const { id } = evt.data;
    const eventType = evt.type;

    console.log(`✅ Received webhook: ${eventType} for ${id}`);

    switch (eventType) {
      case "user.created": {
        const { email_addresses, first_name, last_name, image_url, username, id } = evt.data; // Include id here

        const newUser = await createUser({
          clerkId: id ?? "",
          email: email_addresses?.[0]?.email_address || "",
          username: username || "",
          firstName: first_name || "",
          lastName: last_name || "",
          photo: image_url || "",
        });

        // Ensure newUser has an _id before proceeding
        if (newUser?._id) {
           // Await the client instance first
           const client = await clerkClient();
           // Then use the client instance
           await client.users.updateUserMetadata(id, {
             publicMetadata: { userId: newUser._id },
           });
        } else {
           console.error("Failed to create user or newUser._id is missing");
           // Optionally handle the error, maybe return a 500 status
        }

        return new Response("✅ user.created synced", { status: 200 });
      }

      
      case "user.deleted": {
        const { id } = evt.data; // Get id from evt.data

        // Add a check to ensure 'id' is defined
        if (!id) {
          console.error("❌ Clerk webhook error: Missing user ID for user.deleted event");
          return new Response("Error: Missing user ID", { status: 400 });
        }

        // Now TypeScript knows 'id' is a string
        await deleteUser(id);
        return new Response("✅ user.deleted synced", { status: 200 });
      }

      default:
        console.log(`⚠️ Ignored event: ${eventType}`);
        return new Response("ignored", { status: 200 });
    }
  } catch (err) {
    console.error("❌ Clerk webhook error:", err);
    return new Response("Error verifying webhook", { status: 500 });
  }
}
