// @flow
import React from 'react';
import Page from 'component/page';
import CategoryList from 'component/common/category-list';
import type { Subscription } from 'redux/reducers/subscriptions';
import * as NOTIFICATION_TYPES from 'constants/notification_types';
import Button from 'component/button';
import FileList from 'component/fileList';

type SavedSubscriptions = Array<Subscription>;

type Props = {
  doFetchClaimsByChannel: (string, number) => any,
  // savedSubscriptions: SavedSubscriptions,
  // TODO build out claim types
  subscriptions: Array<any>,
  fetchingSubscriptions: boolean,
  // setHasFetchedSubscriptions: () => void,
  // hasFetchedSubscriptions: boolean,
};

export default class extends React.PureComponent<Props> {
  // setHasFetchedSubscriptions is a terrible hack
  // it allows the subscriptions to load correctly when refresing on the subscriptions page
  // currently the page is rendered before the state is rehyrdated
  // that causes this component to be rendered with zero savedSubscriptions
  // we need to wait until persist/REHYDRATE has fired before rendering the page
  componentDidMount() {
    const {
      savedSubscriptions,
      setHasFetchedSubscriptions,
      notifications,
      setSubscriptionNotifications,
      doFetchMySubscriptions,
    } = this.props;
    doFetchMySubscriptions();
    // if (savedSubscriptions.length) {
    //   this.fetchSubscriptions(savedSubscriptions);
    //   setHasFetchedSubscriptions();
    // }
    // const newNotifications = {};
    // Object.keys(notifications).forEach(cur => {
    //   if (notifications[cur].type === NOTIFICATION_TYPES.DOWNLOADING) {
    //     newNotifications[cur] = { ...notifications[cur] };
    //   }
    // });
    // setSubscriptionNotifications(newNotifications);
  }

  componentWillReceiveProps(nextProps: Props) {
    // const { savedSubscriptions, hasFetchedSubscriptions, setHasFetchedSubscriptions } = props;
    //
    const { subscriptions, doFetchClaimsByChannel } = this.props;
    const { subscriptions: nextSubcriptions } = nextProps;
    //TODO: keep track of current page to allow infinite scrolling
    if (nextSubcriptions.length && nextSubcriptions.length !== subscriptions.length) {
      debugger;
      nextSubcriptions.forEach(sub => doFetchClaimsByChannel(sub.uri, 1));
    }
  }

  render() {
    const { subscriptions, subscriptionClaims, fetchingSubscriptions } = this.props;

    // TODO: if you are subscribed to an empty channel, this will always be true (but it should not be)
    // const someClaimsNotLoaded = Boolean(
    //   subscriptions.find(subscription => !subscription.claims.length)
    // );

    // const fetchingSubscriptions =
    //   !!savedSubscriptions.length &&
    //   (subscriptions.length !== savedSubscriptions.length || someClaimsNotLoaded);
    console.log('props', this.props);
    let claimList = [];
    subscriptionClaims.forEach(claimData => {
      // debugger;
      claimList = claimList.concat(claimData.claims);
    });

    claimList = claimList.map(claim => ({ uri: `lbry://${claim}` }));

    console.log('claimList', claimList);

    return (
      <Page loading={fetchingSubscriptions}>
        {!subscriptions.length && (
          <div className="page__empty">
            {__("It looks like you aren't subscribed to any channels yet.")}
            <div className="card__actions card__actions--center">
              <Button button="primary" navigate="/discover" label={__('Explore new content')} />
            </div>
          </div>
        )}
        {!!claimList.length && <FileList sortByHeight fileInfos={claimList} />
        //   !!subscriptions.length && (
        //   <div>
        //     {!!subscriptions.length &&
        //       subscriptions.map(subscription => {
        //         return subscription.channelName;
        //         // if (!subscription.claims.length) {
        //         //   // will need to update when you can subscribe to empty channels
        //         //   // for now this prevents issues with FeaturedCategory being rendered
        //         //   // before the names (claim uris) are populated
        //         //   return '';
        //         // }
        //
        //         return (
        //           <CategoryList
        //             key={subscription.channelName}
        //             categoryLink={subscription.uri}
        //             category={subscription.channelName}
        //             names={subscription.claims}
        //           />
        //         );
        //       })}
        //   </div>
        // )
        }
      </Page>
    );
  }
}
