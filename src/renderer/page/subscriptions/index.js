import React from 'react';
import { connect } from 'react-redux';
import {
  selectSubscriptionsFromClaims,
  selectSubscriptions,
  selectFetchingSubscriptions,
  selectNotifications,
} from 'redux/selectors/subscriptions';
import { doFetchClaimsByChannel } from 'redux/actions/content';
import {
  setHasFetchedSubscriptions,
  setSubscriptionNotifications,
  doFetchMySubscriptions,
} from 'redux/actions/subscriptions';
import SubscriptionsPage from './view';

const select = state => ({
  fetchingSubscriptions: selectFetchingSubscriptions(state),
  subscriptions: selectSubscriptions(state),
  subscriptionClaims: selectSubscriptionsFromClaims(state),
  notifications: selectNotifications(state),
});

export default connect(select, {
  doFetchClaimsByChannel,
  setSubscriptionNotifications,
  doFetchMySubscriptions,
})(SubscriptionsPage);
