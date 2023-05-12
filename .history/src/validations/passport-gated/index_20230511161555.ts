// import snapshot from '@snapshot-labs/snapshot.js';
// import Validation from '../validation';
// import {
//   getPassport,
//   getVerifiedStamps,
//   hasValidIssuanceAndExpiration
// } from '../passport-weighted/helper';

// export default class extends Validation {
//   public id = 'passport-gated';
//   public github = 'snapshot-labs';
//   public version = '0.1.0';
//   public title = 'Gitcoin Passport Gated';
//   public description =
//     'Protect your proposals from spam and vote manipulation by requiring users to have a Gitcoin Passport.';
//   async validate(): Promise<boolean> {
//     const requiredStamps = this.params.stamps;
//     const passport: any = await getPassport(this.author);
//     if (!passport) return false;
//     if (!passport.stamps?.length || !requiredStamps?.length) return false;

//     const verifiedStamps: any[] = await getVerifiedStamps(
//       passport,
//       this.author,
//       requiredStamps.map((stamp) => ({
//         id: stamp
//       }))
//     );
//     if (!verifiedStamps.length) return false;

//     const provider = snapshot.utils.getProvider(this.network);
//     const proposalTs = (await provider.getBlock(this.snapshot)).timestamp;

//     const operator = this.params.operator;

//     // check issuance and expiration
//     const validStamps = verifiedStamps
//       .filter((stamp) =>
//         hasValidIssuanceAndExpiration(stamp.credential, proposalTs)
//       )
//       .map((stamp) => stamp.provider);

//     // console.log('validStamps', validStamps);
//     // console.log('requiredStamps', requiredStamps);
//     // console.log('operator', operator);

//     if (operator === 'AND') {
//       return requiredStamps.every((stamp) => validStamps.includes(stamp));
//     } else if (operator === 'OR') {
//       return requiredStamps.some((stamp) => validStamps.includes(stamp));
//     } else {
//       return false;
//     }
//   }
// }

/**
 * @fileoverview Passport-gated validation strategy for Snapshot. 
 * This implementation integrates with the Gitcoin API to validate 
 * whether a user is authorized to vote on a proposal. 
 * 
 * Last modified: May 4, 2023
 * 
 * NOTE: The original code used the Passport SDK to check if the user
 * has a valid passport. With the Passport API, we can simply check if
 * the user has a valid passport by looking for a score.
 * 
 * In this function, we are returning a binary score (0 or 1) depending
 * on wether the user's passport is flagged as a likely Sybil.
 * 
 */

// TODO: Run code in Snapshot playground
// TODO: Test API endpoints
// TODO: Make new .env file that has a binary unique humanity score

// QUESTION: Is this.author imply the users wallet already connected?

// FIXME: Currently calls locally stored environment variables

import snapshot from '@snapshot-labs/snapshot.js';
import fetch from 'cross-fetch';
import Validation from '../validation';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// these lines read the API key and scorer ID from the .env.local file
const API_KEY = process.env.NEXT_PUBLIC_GC_API_KEY
const SCORER_ID = process.env.NEXT_PUBLIC_GC_SCORER_ID

// endpoint for getting the signing message
const SIGNING_MESSAGE_URI = 'https://api.scorer.gitcoin.co/registry/signing-message'
// endpoint for submitting passport
const SUBMIT_PASSPORT_URI = 'https://api.scorer.gitcoin.co/registry/submit-passport'

const headers = API_KEY ? ({
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY
}) : undefined

// global.d.ts
declare global {
  interface Window {
    ethereum: any;
  }
}


export default class extends Validation {
    public id = 'passport-gated';
    public github = 'snapshot-labs';
    public version = '0.1.0';
    public title = 'Gitcoin Passport Gated';
    public description =
      'Protect your proposals from spam and vote manipulation by requiring users to have a Gitcoin Passport.';

    /* get signing message from API */
    async getSigningMessage() {
        try {
            const response = await fetch(SIGNING_MESSAGE_URI, {
            headers
            })
            const json = await response.json()
            return json
        } catch (err) {
            console.log('error: ', err)
        }
    }

    /* Send the signed message along with other arguments in a 
    separate API call to submit their passport */
    async submitPassport() {
        try {
          // call the API to get the signing message and the nonce
          const { message, nonce } = await this.getSigningMessage()
          //console.log(message, nonce);

          // asks user to sign the message
          const provider = snapshot.utils.getProvider(this.network);
          const signer = await provider.getSigner()

          // signs message if wallet is properly connected
          let signature = '';
          try {
            signature = await signer.signMessage(message);
          } catch (err) {
            console.log('Error signing message:', err);
          }
          
          const address = this.author;
    
          // call the API, sending the signing message, the signature, and the nonce
          const response = await fetch(SUBMIT_PASSPORT_URI, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              address,
              scorer_id: SCORER_ID,
              signature,
              nonce
            })
          })
    
          const data = await response.json()
          console.log('data:', data)
        } catch (err) {
          console.log('error: ', err)
        }
      }

    /* check the user's passport for scoring and returns true if user has a score */
    async validate(currentAddress = this.author): Promise<boolean> {
        const GET_PASSPORT_SCORE_URI = `https://api.scorer.gitcoin.co/registry/score/${SCORER_ID}/${currentAddress}`

        // Testing getSigningMessage
        console.log('Testing getSigningMessage...');
        const signingMessageResult = await this.getSigningMessage();
        console.log('getSigningMessage result:', signingMessageResult);

        // Testing submitPassport
        console.log('Testing submitPassport...');
        const submitPassportResult = await this.submitPassport();
        console.log('submitPassport result:', submitPassportResult);

        try {
          const response = await fetch(GET_PASSPORT_SCORE_URI, {
            headers
          })
          console.log(response)
          const passportData = await response.json()
          console.log(passportData.score)
          if (passportData.score) {
            // if the user has a score, they have a valid passport
            return true;
          } else {
            // if the user has no score, display a message letting them know to submit their passport
            console.log('You do not have a valid Gitcoin Passport. Create one by visiting https://passport.gitcoin.co/ ')
            return false;
            }
        } catch (err) {
          console.log('error: ', err)
          return false;
        }
    }
  }
