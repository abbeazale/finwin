import { toNodeHandler } from "better-auth/node"
import { auth } from "@/lib/auth"

// Better Auth needs the raw request body.
export const config = { api: { bodyParser: false } }

export default toNodeHandler(auth.handler)
