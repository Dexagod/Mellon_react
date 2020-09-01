import React from 'react';
import solid from 'solid-auth-client'
import CommunicationManager from '../util/CommunicationManager';
import NotificationHandler from 'util/NotificationHandler';
import AsyncListItemNotification from "./AsyncListItemNotification"
import List from '@material-ui/core/List';
import { UploadFileComponent } from './UploadFileComponent';
import "../styles/Sidebar.css"
import { Paper, Divider, Button } from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';

const REFRESHRATE = 20000

export default class NotificationsSideBar extends React.Component {

  constructor(props) {
    super(props)
    this.cm = props.cm || new CommunicationManager(solid);
    this.nh = new NotificationHandler(this.cm, solid);
    this.update = this.update.bind(this)
    this.showMore = this.showMore.bind(this)
    this.timeout = null;

    this.loadSize = 2

    this.state = {
      notifications: [],
      startIndex: 0,
      endIndex: this.loadSize,
      allLoaded: true
    };
  }

  componentDidMount() {
    this.timeout = setInterval(this.update, REFRESHRATE);
    this.update();
  }
  componentWillUnmount() {
    clearInterval(this.timeout);
  }

  shouldComponentUpdate(nextprops, nextstate) {
    if (this.state.startIndex !== nextstate.startIndex || this.state.endIndex !== nextstate.endIndex) {
      return true;
    }
    if(this.state.notifications.length !== nextstate.notifications.length) return true;
    let oldnotifs = nextstate.notifications.map(notif => notif.id).sort()
    let newnotifs = this.state.notifications.map(notif => notif.id).sort()
    for (let i = 0; i < oldnotifs.length; i++) {
      if (oldnotifs[i] !== newnotifs[i]) {
        return true;
      }
    }
    return false;
  }

  async update(){
    console.log("updating notifications")
    const session = await solid.currentSession()
    const webId = session.webId
    if(!webId) return;

    const inbox = await this.nh.discoverInboxUri(webId);
    if (!inbox) throw new Error("InboxViewContainer not correctly initialized");
    console.log("INBOX", inbox);
    const notifications = await this.nh.getNotificationIdsForURI(
      webId
    );
    notifications.sort((a, b) => { return b.date - a.date})
    console.log("NOTIFICATIONS", notifications)
    this.setState(state => ({notifications, allLoaded: state.startIndex === 0 && state.endIndex >= notifications.length}));
  }

  showMore() {
    this.setState(state => ({
      endIndex: state.endIndex + this.loadSize,
      allLoaded: state.startIndex === 0 && state.endIndex  + this.loadSize >= state.notifications.length
    }));
  }

  render(){
    let notificationList = this.state.notifications
      .slice(this.state.startIndex, this.state.endIndex)
      .map(notification =>
        <AsyncListItemNotification key={notification.id} metadata={notification} cm={this.cm} navigateToFile={this.props.navigateToFile} />
      )

    return (
      <Paper variant="elevation" elevation={10} className="sidebarcomponentcontainer col-md-5">
        <div className="uppercontainer">
        <p>Notifications</p>
          <div className="sidebarList disable-scrollbars">
            <List>
              {notificationList}
            </List>
            {!this.state.allLoaded ? <Button onClick={this.showMore} endIcon={<ExpandMoreIcon />}>Show more</Button> : null}
          </div>
        </div>
        <Divider />
        <div className="lowercontainer">
          <UploadFileComponent className="fileAdd" navigateToFile={this.props.navigateToFile}
            me={this.props.me} contacts={this.props.contacts} />
        </div>
      </Paper>
    );
  }
}


