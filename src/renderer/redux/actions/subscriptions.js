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

const CHECK_SUBSCRIPTIONS_INTERVAL = 60 * 60 * 1000;
const SUBSCRIPTION_DOWNLOAD_LIMIT = 1;

const getClaimId = uri => {
  // const subscription = `${subscription.}`
  const index = uri.indexOf('#');
  const claimId = uri.slice(index);
  return claimId;
};

export const doFetchMySubscriptions = () => (dispatch: Dispatch, getState: () => any) => {
  const { subscriptions: subscriptionsState } = getState();
  const { subscriptions } = subscriptionsState;

  dispatch({ type: ACTIONS.FETCH_MY_SUBSCRIPTIONS_START });

  Lbryio.call('subscription', 'list')
    .then(dbSubscriptions => {
      // sync db with hydrated redux store
      if (!dbSubscriptions && subscriptions.length) {
        // user has never synced subscriptions, populate them all
        const subscriptionPayloads = subscriptions.slice().map(subscription => ({
          channel_name: subscription.channelName,
          claim_id: getClaimId(subscription.uri),
        }));
        // debugger;

        return Promise.all(
          subscriptionPayloads.map(payload => Lbryio.call('subscription', 'new', payload))
        ).then(() => {
          // sucessfuly synced redux subscriptions with db
          return subscriptions.map(sub => ({
            channelName: sub.channel_name,
            uri: `lbry://${sub.channel_name}${sub.claim_hash}`,
          }));
        });
      } else if (!dbSubscriptions && !subscriptions.length) {
        return [];
      }
      // if (subscriptions.length && (!dbSubscriptions || subscriptions.length > dbSubscriptions.length)) {
      //   debugger;
      //
      // }

      // dispatch();
      return dbSubscriptions.map(sub => ({
        channelName: sub.channel_name,
        uri: `lbry://${sub.channel_name}${sub.claim_hash}`,
      }));
    })
    .then(subscriptions => {
      // debugger;
      console.log('subs', subscriptions);
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

export const doChannelSubscribe = (subscription: Subscription) => (dispatch: Dispatch) => {
  const claimId = getClaimId(subscription.uri);

  // debugger;
  // debugger;
  Lbryio.call('subscription', 'new', {
    channel_name: subscription.channelName,
    claim_id: claimId,
  })
    .then(res => {
      // debugger;
      dispatch({
        type: ACTIONS.CHANNEL_SUBSCRIBE,
        data: subscription,
      });
    })
    .catch(err => {
      debugger;
    });

  dispatch(doCheckSubscription(subscription, true));
};

export const doChannelUnsubscribe = (subscription: Subscription) => (dispatch: Dispatch) => {
  const claimId = getClaimId(subscription.uri);

  Lbryio.call('subscription', 'delete', {
    claim_id: claimId,
  })
    .then(() => {
      dispatch({
        type: ACTIONS.CHANNEL_UNSUBSCRIBE,
        data: subscription,
      });
    })
    .catch(() => {});
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
