import { createSelector } from 'reselect';
import { makeSelectClaimForUri } from 'lbry-redux';

const selectState = state => state.media || {};

export const selectMediaPaused = createSelector(selectState, state => state.paused);

export const makeSelectMediaPositionForUri = uri =>
  createSelector(selectState, makeSelectClaimForUri(uri), (state, claim) => {
    const outpoint = `${claim.txid}:${claim.nout}`;
    return state.positions[outpoint] || null;
  });

// export const makeSelectMediaPositionForUri = uri =>
//   createSelector(
//     selectState,
//     makeSelectClaimForUri(uri),
//     (state, claim) => state.content[claim.claim_id].position[claim.outpoint] || null;
//   });
