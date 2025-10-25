import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest } from "next/server";
import { createClerkClient } from "@clerk/backend"; // ✅ use createClerkClient instead of clerkClient
import { createUser, updateUser, deleteUser } from "@/lib/actions/user.actions";

export async function POST(req: NextRequest) {
  try {
    // Clerk automatically verifies using CLERK_WEBHOOK_SIGNING_SECRET
    const evt = await verifyWebhook(req);
    const { id } = evt.data;
    const eventType = evt.type;

    console.log(`✅ Received webhook: ${eventType} for ${id}`);

    // ✅ Create backend Clerk client instance
    const clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    switch (eventType) {
      case "user.created": {
        const { email_addresses, first_name, last_name, image_url, username } = evt.data;

        const newUser = await createUser({
          clerkId: id ?? "",
          email: email_addresses?.[0]?.email_address || "",
          username: username || "",
          firstName: first_name || "",
          lastName: last_name || "",
          photo: image_url || "",
        });

        if (newUser?._id) {
          await clerkClient.users.updateUserMetadata(id ?? "", {
            publicMetadata: { userId: newUser._id },
          });
        }

        return new Response("✅ user.created synced", { status: 200 });
      }

      case "user.updated": {
        const { first_name, last_name, image_url, username } = evt.data;
        await updateUser(id ?? "", {
          firstName: first_name || "",
          lastName: last_name || "",
          username: username || "",
          photo: image_url || "",
        });
        return new Response("✅ user.updated synced", { status: 200 });
      }

      case "user.deleted": {
        await deleteUser(id ?? "");
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
