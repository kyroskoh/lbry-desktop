// @flow
import * as ACTIONS from 'constants/action_types';
import * as NOTIFICATION_TYPES from 'constants/notification_types';
import type {
  Subscription,
  Dispatch,
  SubscriptionState,
  SubscriptionNotifications,
} from 'redux/reducers/subscriptions';
import { selectSubscriptions } from 'redux/selectors/subscriptions';
import { Lbry, buildURI } from 'lbry-redux';
import { doPurchaseUri } from 'redux/actions/content';
import { doNavigate } from 'redux/actions/navigation';
import Promise from 'bluebird';
import Lbryio from 'lbryio';
import { doFetchClaimsByChannel } from 'redux/actions/content';

const CHECK_SUBSCRIPTIONS_INTERVAL = 60 * 60 * 1000;
const SUBSCRIPTION_DOWNLOAD_LIMIT = 1;

const getClaimId = uri => {
  // const subscription = `${subscription.}`
  const index = uri.indexOf('#');
  const claimId = uri.slice(index + 1);
  return claimId;
};

export const doFetchMySubscriptions = () => (dispatch: Dispatch, getState: () => any) => {
  const { subscriptions: subscriptionState, settings: { daemonSettings } } = getState();
  const { subscriptions: reduxSubscriptions } = subscriptionState;
  const { share_usage_data: isSharingData } = daemonSettings;

  if (!isSharingData && isSharingData !== undefined) {
    // They aren't sharing their data, subscriptions will be handled by persisted redux state
    return;
  }

  dispatch({ type: ACTIONS.FETCH_MY_SUBSCRIPTIONS_START });

  Lbryio.call('subscription', 'list')
    .then(dbSubscriptions => {
      // User has no subscriptions in db or redux
      if (!dbSubscriptions && (!reduxSubscriptions || !reduxSubscriptions.length)) {
        debugger;
       return [];
     }

     // User has never synced subscriptions, populate them all
     // This could be if this is the first time syncing, or if they
     // subscribed to channels only after turning off share_usage_data
     if (!dbSubscriptions && reduxSubscriptions.length) {
       debugger;
        const subscriptionPayloads = reduxSubscriptions.slice().map(subscription => ({
          channel_name: subscription.channelName,
          claim_id: getClaimId(subscription.uri),
        }));

        return Promise.all(
          subscriptionPayloads.map(payload => Lbryio.call('subscription', 'new', payload))
        ).then(() => {
          // sucessfuly synced redux subscriptions with db
          return reduxSubscriptions;
        });
      }

      // There is some mismatch between redux state and db state
      // Populate the ones that aren't in the db, then dispatch with all of them
      if (dbSubscriptions.length !== reduxSubscriptions.length) {

      const dbSubMap = {};
      dbSubscriptions.forEach(sub => {
        dbSubMap[sub.claim_id] = 1
      });

      const subsNotInDB = [];
      reduxSubscriptions.forEach(sub => {
        const claimId = getClaimId(sub.uri);

        if (!dbSubMap[claimId]) {
          subsNotInDB.push({
            claim_id: claimId,
            channel_name: sub.channelName
          });
        }
      });

      return Promise.all(
        subsNotInDB.map(payload => Lbryio.call('subscription', 'new', payload))
      )
      .then(() => {
        // combine dbSubscriptions and reduxSubscriptions
        const formattedDBSubscriptions = dbSubscriptions.map(sub => ({
          channelName: sub.channel_name,
          uri: `${sub.channel_name}#${sub.claim_id}`
        }));

        // debugger;

        const totalSubscriptions = reduxSubscriptions.concat(formattedDBSubscriptions)
        return totalSubscriptions
      })
    }

    return reduxSubscriptions

      //
      // // if (subscriptions.length && (!dbSubscriptions || subscriptions.length > dbSubscriptions.length)) {
      // //   debugger;
      // //
      // // }
      //
      // return dbSubscriptions.map(sub => ({
      //   channelName: sub.channel_name,
      //   uri: `lbry://${sub.channel_name}${sub.claim_id}`,
      // }));
    })
    .then(subscriptions => {
      // console.log('subs', subscriptions);
      dispatch({
        type: ACTIONS.FETCH_MY_SUBSCRIPTIONS_SUCCESS,
        data: subscriptions,
      });
    })
    .catch(err => {
      debugger;
      dispatch({
        type: ACTIONS.FETCH_MY_SUBSCRIPTIONS_FAIL,
        data: err,
      });
    });
};

export const doChannelSubscribe = (subscription: Subscription) => (dispatch: Dispatch, getState: () => any) => {
  const { settings: { daemonSettings } } = getState();
  const { share_usage_data: isSharingData } = daemonSettings;

  dispatch({
    type: ACTIONS.CHANNEL_SUBSCRIBE,
    data: subscription,
  });
  // if the user isn't sharing data, keep the subscriptions entirely in the app
  if (isSharingData) {
    const claimId = getClaimId(subscription.uri);
    // They are sharing data, we can store their subscriptions in our internal database
    Lbryio.call('subscription', 'new', {
      channel_name: subscription.channelName,
      claim_id: claimId,
    })
    .then(() => {
      // sucessfuly added to db
    })
    .catch(err => {
      debugger;
    });
  }

  dispatch(doCheckSubscription(subscription, true));
};

export const doChannelUnsubscribe = (subscription: Subscription) => (dispatch: Dispatch) => {
  dispatch({
    type: ACTIONS.CHANNEL_UNSUBSCRIBE,
    data: subscription,
  });
  // If they subscribed, then stopped sharing data, we still want to remove it from the db
  // If it doesn't exist, it should still return a success
  const claimId = getClaimId(subscription.uri);
  Lbryio.call('subscription', 'delete', {
    claim_id: claimId,
  })
  .then(() => {
    // sucess
  })
  .catch(() => {
    debugger;
  });
};

export const doCheckSubscriptions = () => (
  dispatch: Dispatch,
  getState: () => SubscriptionState
) => {
  const checkSubscriptionsTimer = setInterval(
    () =>
      selectSubscriptions(getState()).map((subscription: Subscription) =>
        dispatch(doCheckSubscription(subscription, true))
      ),
    CHECK_SUBSCRIPTIONS_INTERVAL
  );
  dispatch({
    type: ACTIONS.CHECK_SUBSCRIPTIONS_SUBSCRIBE,
    data: { checkSubscriptionsTimer },
  });
};

export const doCheckSubscription = (subscription: Subscription, notify?: boolean) => (
  dispatch: Dispatch
) => {
  dispatch({
    type: ACTIONS.CHECK_SUBSCRIPTION_STARTED,
    data: subscription,
  });

  Lbry.claim_list_by_channel({ uri: subscription.uri, page: 1 }).then(result => {
    const claimResult = result[subscription.uri] || {};
    const { claims_in_channel: claimsInChannel } = claimResult;

    if (claimsInChannel) {
      if (notify) {
        claimsInChannel.reduce((prev, cur, index) => {
          const uri = buildURI({ contentName: cur.name, claimId: cur.claim_id }, false);
          if (prev === -1 && uri !== subscription.latest) {
            dispatch(
              setSubscriptionNotification(
                subscription,
                uri,
                index < SUBSCRIPTION_DOWNLOAD_LIMIT && !cur.value.stream.metadata.fee
                  ? NOTIFICATION_TYPES.DOWNLOADING
                  : NOTIFICATION_TYPES.NOTIFY_ONLY
              )
            );
            if (index < SUBSCRIPTION_DOWNLOAD_LIMIT && !cur.value.stream.metadata.fee) {
              dispatch(doPurchaseUri(uri, { cost: 0 }));
            }
          }
          return uri === subscription.latest || !subscription.latest ? index : prev;
        }, -1);
      }

      dispatch(
        setSubscriptionLatest(
          {
            channelName: claimsInChannel[0].channel_name,
            uri: buildURI(
              {
                channelName: claimsInChannel[0].channel_name,
                claimId: claimsInChannel[0].claim_id,
              },
              false
            ),
          },
          buildURI(
            { contentName: claimsInChannel[0].name, claimId: claimsInChannel[0].claim_id },
            false
          )
        )
      );
    }

    dispatch({
      type: ACTIONS.CHECK_SUBSCRIPTION_COMPLETED,
      data: subscription,
    });
  });
};

export const setSubscriptionLatest = (subscription: Subscription, uri: string) => (
  dispatch: Dispatch
) =>
  dispatch({
    type: ACTIONS.SET_SUBSCRIPTION_LATEST,
    data: {
      subscription,
      uri,
    },
  });

export const setSubscriptionNotification = (
  subscription: Subscription,
  uri: string,
  notificationType: string
) => (dispatch: Dispatch) =>
  dispatch({
    type: ACTIONS.SET_SUBSCRIPTION_NOTIFICATION,
    data: {
      subscription,
      uri,
      type: notificationType,
    },
  });

export const setSubscriptionNotifications = (notifications: SubscriptionNotifications) => (
  dispatch: Dispatch
) =>
  dispatch({
    type: ACTIONS.SET_SUBSCRIPTION_NOTIFICATIONS,
    data: {
      notifications,
    },
  });

export const setHasFetchedSubscriptions = () => (dispatch: Dispatch) =>
  dispatch({ type: ACTIONS.HAS_FETCHED_SUBSCRIPTIONS });
