/* eslint-disable @typescript-eslint/no-require-imports */
const { listAllDocuments, listCorrespondents } = require('./lib/paperless');
require('dotenv').config({ path: '.env.local' });

async function smokeTest() {
  console.log('Testing Paperless-ngx connection...');
  console.log('Base URL:', process.env.PAPERLESS_BASE_URL);

  try {
    const correspondents = await listCorrespondents();
    console.log(`✅ Successfully fetched ${correspondents.length} correspondents.`);

    const docs = await listAllDocuments();
    console.log(`✅ Successfully fetched ${docs.length} documents.`);

    if (docs.length > 0) {
      console.log('Sample Document:', {
        id: docs[0].id,
        title: docs[0].title,
        created: docs[0].created
      });
    }
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

smokeTest();
