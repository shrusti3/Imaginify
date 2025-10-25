import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest, NextResponse } from "next/server"; // Import NextResponse
import { createClerkClient } from "@clerk/backend";
import { createUser, updateUser, deleteUser } from "@/lib/actions/user.actions";

// Instantiate the Clerk client outside the function if possible, or ensure it's properly awaited
// Note: createClerkClient might be intended for non-Next.js server environments.
// For Next.js App Router API routes, using clerkClient from '@clerk/nextjs/server' might be preferred if applicable.
// However, sticking with the user's current code structure using createClerkClient:
const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
});

export async function POST(req: NextRequest) {
    try {
        console.log("SIGNING SECRET EXISTS:", !!process.env.CLERK_WEBHOOK_SIGNING_SECRET); // Use the correct variable name if needed
        const evt = await verifyWebhook(req);
        const { id } = evt.data;
        const eventType = evt.type;

        console.log(`✅ Received webhook: ${eventType} for ${id}`);

        switch (eventType) {
            case "user.created": {
                const { email_addresses, first_name, last_name, image_url, username, id: clerkId } = evt.data; // Destructure id as clerkId

                // --- Input Validation ---
                const email = email_addresses?.[0]?.email_address;
                const actualUsername = username; // Clerk might send null for username

                if (!clerkId) {
                    console.error("❌ Clerk webhook error: Missing ID for user.created");
                    return new Response("Error: Missing required user ID", { status: 400 });
                }
                if (!email) {
                    console.error(`❌ Clerk webhook error: Missing email for user.created, Clerk ID: ${clerkId}`);
                    return new Response("Error: Missing required email", { status: 400 });
                }
                 if (!actualUsername) {
                     // Handle missing username - either generate one or return error if strictly required
                     console.error(`❌ Clerk webhook error: Missing username for user.created, Clerk ID: ${clerkId}`);
                     // If username is absolutely required by your DB schema:
                     return new Response("Error: Missing required username", { status: 400 });
                     // Or generate a fallback if your schema allows it:
                     // actualUsername = email; // Example fallback
                 }
                // --- End Input Validation ---

                let newUser;
                try {
                    newUser = await createUser({
                        clerkId: clerkId,
                        email: email,
                        username: actualUsername, // Use the validated/generated username
                        firstName: first_name || "",
                        lastName: last_name || "",
                        photo: image_url || "",
                    });
                     console.log(`✅ User created in DB with ID: ${newUser?._id} for Clerk ID: ${clerkId}`);
                } catch (dbError: any) { // Catch specific DB errors
                    console.error(`❌ DB Error creating user for Clerk ID ${clerkId}:`, dbError);
                    // Check if it's a duplicate key error (if email/username must be unique)
                    if (dbError.code === 11000) {
                         return new Response("User already exists", { status: 409 }); // Conflict
                    }
                    return new Response(`Error creating user: ${dbError.message}`, { status: 500 });
                }


                if (newUser?._id) {
                    try {
                        await clerkClient.users.updateUserMetadata(clerkId, {
                            publicMetadata: { userId: newUser._id },
                        });
                        console.log(`✅ Metadata updated for Clerk user ${clerkId}`);
                    } catch (metaError) {
                         console.error(`❌ Error updating Clerk metadata for ${clerkId}:`, metaError);
                         // Decide how critical this is - maybe don't fail the whole request?
                    }
                } else {
                    console.error(`❌ Failed to get newUser._id after DB creation for Clerk ID: ${clerkId}`);
                    // This indicates a problem with the createUser function or DB response
                     return new Response("Error: DB user ID not available after creation", { status: 500 });
                }

                // Use NextResponse for cleaner JSON responses in Next.js API routes
                return NextResponse.json({ message: "✅ user.created synced", user: newUser }, { status: 201 }); // 201 Created
            }

            case "user.updated": {
                const { id: clerkId, first_name, last_name, image_url, username } = evt.data;

                if (!clerkId) {
                  console.error("❌ Clerk webhook error: Missing user ID for user.updated event");
                  return new Response("Error: Missing user ID", { status: 400 });
                }

                try {
                  await updateUser(clerkId, {
                    firstName: first_name || "",
                    lastName: last_name || "",
                    // Only update username if provided, otherwise keep existing? Check updateUser logic
                    username: username || "",
                    photo: image_url || "",
                  });
                   console.log(`✅ User updated in DB for Clerk ID: ${clerkId}`);
                   return NextResponse.json({ message: "✅ user.updated synced" }, { status: 200 });
                } catch (dbError: any) {
                    console.error(`❌ DB Error updating user for Clerk ID ${clerkId}:`, dbError);
                    return new Response(`Error updating user: ${dbError.message}`, { status: 500 });
                }
            }

            case "user.deleted": {
                const { id: clerkId } = evt.data;

                 if (!clerkId) {
                   console.error("❌ Clerk webhook error: Missing user ID for user.deleted event");
                   return new Response("Error: Missing user ID", { status: 400 });
                 }

                try {
                  await deleteUser(clerkId);
                   console.log(`✅ User deleted in DB for Clerk ID: ${clerkId}`);
                   return NextResponse.json({ message: "✅ user.deleted synced" }, { status: 200 });
                } catch (dbError: any) {
                     console.error(`❌ DB Error deleting user for Clerk ID ${clerkId}:`, dbError);
                     return new Response(`Error deleting user: ${dbError.message}`, { status: 500 });
                }
            }

            default:
                console.log(`⚠️ Ignored event: ${eventType}`);
                return new Response("ignored", { status: 200 });
        }
    } catch (err: any) { // Catch errors more specifically
        // Differentiate between verification errors and other errors
        if (err.message && err.message.includes("Webhook verification failed")) {
             console.error("❌ Clerk webhook verification failed:", err.message);
             return new Response("Error verifying webhook", { status: 401 }); // Unauthorized
        }
        console.error("❌ Unhandled Clerk webhook error:", err);
        return new Response("Internal Server Error", { status: 500 });
    }
}