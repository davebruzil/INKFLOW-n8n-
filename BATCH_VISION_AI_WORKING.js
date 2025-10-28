// WORKING BATCH VISION AI - No setTimeout, uses Wait node + smart checking
// Place AFTER "Merge Image Customer Data", BEFORE Wait node

const inputItem = $input.first();
const sessionId = inputItem.json.sessionId;
const senderPhone = inputItem.json.senderPhone;
const imageUrl = inputItem.json.publicUrl;
const chatInput = inputItem.json.chatInput || '';

console.log('📸 Image received for batching');
console.log('👤 Session:', sessionId);
console.log('🖼️ URL:', imageUrl);

const staticData = $getWorkflowStaticData('global');

if (!staticData.imageBatches) {
  staticData.imageBatches = {};
}

const now = Date.now();

// Store this image with unique ID
const imageId = `${sessionId}_${now}_${Math.random()}`;

// Initialize or update batch
if (!staticData.imageBatches[sessionId]) {
  staticData.imageBatches[sessionId] = {
    images: {},
    firstImageTime: now,
    lastImageTime: now
  };
  console.log('✨ Created new batch');
}

const batch = staticData.imageBatches[sessionId];

// Add this image
batch.images[imageId] = {
  url: imageUrl,
  caption: chatInput,
  timestamp: now,
  binary: inputItem.binary,
  senderJID: inputItem.json.senderJID,
  json: inputItem.json
};
batch.lastImageTime = now;

const currentCount = Object.keys(batch.images).length;
console.log(`📊 Batch now has ${currentCount} images`);

// Pass through WITH metadata for next node to decide
return [{
  json: {
    ...inputItem.json,
    _batchId: imageId,
    _batchSessionId: sessionId,
    _currentBatchCount: currentCount,
    _batchFirstTime: batch.firstImageTime,
    _batchLastTime: batch.lastImageTime
  },
  binary: inputItem.binary
}];
