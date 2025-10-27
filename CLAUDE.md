# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **n8n workflow automation project** for a **WhatsApp-based tattoo consultation bot**. The system integrates with WhatsApp via the WaSender API to provide AI-powered customer service for a tattoo artist specializing in realism and fine-line styles.

The workflow handles:
- WhatsApp message reception and routing
- AI-powered conversation management with memory
- Image analysis for tattoo inspiration photos
- Customer data collection and MongoDB storage
- Conditional logic for AI activation/deactivation (human intervention mode)
- Conversation summarization and lead capture

## Core Architecture

### Main Workflow File
- **IMAGE (8).json** - Primary n8n workflow definition containing all nodes, connections, and logic

### Key Workflow Nodes & Flow

1. **WhatsApp Webhook Receiver** → Entry point for all WhatsApp messages
2. **If2** → Determines if message contains image or is text-only
3. **Code** → Parses WhatsApp webhook data, extracts sender info, session ID, and message content
4. **MongoDB1** + **check ai active** → Queries database to check if AI is enabled for this customer
5. **If1** → Routes to human intervention message if AI is disabled
6. **AI Agent** (text) / **AI Agent1** (images) → OpenAI-powered conversational agents with memory
7. **Process AI Response** → Analyzes AI output to detect conversation completion signals
8. **CONVO** → Stores full conversation history in workflow static data
9. **If** → Determines if summary should be triggered based on completion indicators
10. **CHECK DUP** → Prevents duplicate summary creation within 30-second window
11. **Prepare WhatsApp Summary** → Formats conversation for summarization
12. **Summarize WhatsApp Chat** → Uses GPT-4o to extract structured client data
13. **Format WhatsApp Data** → Prepares MongoDB document with proper field mapping
14. **Fetch Existing Client** → Queries MongoDB to retrieve any existing client record (including images)
15. **Merge Image Data** → Intelligently merges existing images array with new summary data
16. **MongoDB** → Upserts client record with conversation summary AND preserved images
17. **Send WhatsApp Reply** / **Send WhatsApp Reply1** → Sends AI response back to customer
18. **Webhook Response** → Completes the webhook request

### Image Processing Flow
- **decrypt image** → Decrypts WhatsApp media using WaSender API
- **download** → Downloads image from public URL
- **AI Agent1** → Analyzes image with vision capabilities (GPT-4.1-mini)
- **image db** → Stores image URL and analysis in MongoDB under customer record

### Data Storage Structure (MongoDB)

**Collection**: `clients`

**Key Fields**:
- `name` - Customer's full name (extracted from conversation)
- `phone_number` - Clean phone number (digits only) - used as unique key
- `idea_summary` - AI-generated summary of tattoo idea with details (style, size, location)
- `meeting_type` - Type of consultation
- `ai_active` - Boolean flag to enable/disable AI (false = human intervention mode)
- `session_id` - Format: `whatsapp_{phone_number}`
- `conversation_length` - Number of exchanges in conversation
- `platform` - Always "whatsapp"
- `images` - Array of image objects with `url`, `analysis`, `timestamp`
- `has_images` - Boolean flag
- `image_count` - Total images sent
- `last_image_upload` - Timestamp of most recent image
- `timestamp`, `created_at`, `updated_at` - Temporal tracking
- `raw_response` - JSON string with original data

## Configuration Files

### mcp.json
MCP (Model Context Protocol) server configuration for n8n integration:
- **Server**: `n8n-mcp`
- **Command**: `cmd /c npx n8n-mcp`
- **Environment Variables**:
  - `N8N_API_URL`: Workflow webhook endpoint
  - `N8N_API_KEY`: JWT authentication token
  - `MCP_MODE`: stdio
  - `LOG_LEVEL`: error

## AI System Prompt Logic

The AI agent follows a structured conversation flow in Hebrew:

1. **Initial greeting** → Asks how to help
2. **After idea shared** → **Always asks for full name first**
3. **After name received** → Asks for missing details (size, location)
4. **Style validation** → Redirects non-matching styles (manga, graffiti, Disney) to realism/fine-line
5. **Price inquiries** → Explains pricing requires consultation
6. **Completion signals** → When name + idea + size + location are collected, thanks customer and triggers summary

**Completion Detection Logic** (Process AI Response node):
- Looks for name extraction patterns in Hebrew
- Detects completion phrases: תודה, מושלם, מעולה, נחזור אליך, etc.
- Triggers summary when: (name + 1+ completion phrases) OR (2+ completion phrases) OR (name + "תודה")

## Working with This Codebase

### To modify the workflow:
1. Import **IMAGE (8).json** into your n8n instance
2. Update credentials for:
   - MongoDB connection (id: 1WkBNfNUOsjMSbAf)
   - OpenAI API (id: 7DtKXoDdZvRLt3w3)
   - WaSender API bearer token (in HTTP Request nodes)

### To test the workflow:
- Send POST request to the webhook URL with WhatsApp message structure
- Test image flow by including `imageMessage` in webhook data
- Verify MongoDB writes in `clients` collection

### To modify AI behavior:
- Edit system message in **AI Agent** node (line 492) or **AI Agent1** node (line 546)
- Adjust completion detection logic in **Process AI Response** node (line 37)
- Modify summary extraction in **Summarize WhatsApp Chat** system prompt (line 155)

### Key JavaScript Code Nodes:
- **Code** (line 441) - WhatsApp webhook parser
- **Process AI Response** (line 37) - Completion detection with Hebrew regex
- **CONVO** (line 529) - Conversation history storage using workflow static data
- **CHECK DUP** (line 248) - Deduplication using global static data with 30s window
- **Prepare WhatsApp Summary** (line 136) - Formats full conversation for summarization
- **Format WhatsApp Data** (line 185) - MongoDB document preparation
- **Merge Image Data** (line 660) - **NEW** Preserves existing images when saving summary data
- **check ai active** (line 283) - AI toggle logic with human intervention fallback

## Important Notes

- **Conversation memory** is handled via `memoryBufferWindow` nodes with custom session IDs
- **Static data storage** is used for conversation history and deduplication (not persisted between workflow restarts)
- **Phone numbers** are cleaned (digits only) and used as unique identifiers
- **Hebrew language** is used throughout the conversational flow
- **Image analysis** uses vision-capable models (gpt-4.1-mini) with binary image passthrough
- **Image preservation** is handled by fetching existing client data and merging before MongoDB save (prevents images from being overwritten when summary triggers)
- **Webhook response** must be sent to complete HTTP request (node: Webhook Response)

## Recent Updates

### CRITICAL FIX: MongoDB Query Operations (2025-10-19)
**Problem:** Both **MongoDB1** and **Fetch Existing Client** nodes were missing the `"operation": "find"` parameter, causing them to fail silently and return empty results even when matching documents existed in the database.

**Root Cause:** n8n's MongoDB node (v1.2) requires an explicit operation parameter. Without it, the node doesn't execute query operations properly.

**Solution:** Added `"operation": "find"` parameter to both nodes:
1. **MongoDB1** (line 260-279) - Now properly queries for ai_active status
2. **Fetch Existing Client** (line 693-712) - Now successfully retrieves existing client records with images

**Impact:**
- AI activation toggle now works correctly
- Image preservation logic now functions as designed (Fetch can actually find existing records)
- Conversation summaries now properly merge with existing client data

**Technical Details:**
```json
{
  "parameters": {
    "operation": "find",  // CRITICAL - must be specified
    "collection": "clients",
    "options": {},
    "query": "={{ JSON.stringify({ phone_number: $json.phone_number }) }}"
  }
}
```

### Image Preservation Fix (2025-10-18)
**Problem:** Images were being lost when conversation summary triggered because MongoDB upsert was overwriting the entire document.

**Solution:** Added two new nodes in the summary flow:
1. **Fetch Existing Client** - Queries MongoDB for existing client record before save
2. **Merge Image Data** - Intelligently merges existing images array with new summary data

**Flow:** `Format WhatsApp Data → Fetch Existing Client → Merge Image Data → MongoDB`

**Result:** Images are now preserved across conversation summary saves. The merge logic handles both new clients (no existing record) and returning clients (with images).
