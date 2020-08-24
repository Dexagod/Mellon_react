import React from 'react'
import solid from 'solid-auth-client'

import CommunicationManager from 'util/CommunicationManager';
import AccessControlTable from './AccessControlTable'
import { MODES, createPermission } from '../util/PermissionManager'

import "../styles/AccessController.css"

export class AccessController extends React.Component {

	constructor(props) {
		super(props);

		this.cm = props.cm || new CommunicationManager(solid);
		let documentURI = Object.keys(props.selection)[0];

		this.state = {
			userHasControl: false,
			documentURI,
			contacts: [],
			permissions: [],
			commentPermissions: [],
			tableData: []
		};
	}

	// fetch data after creation
	async componentDidMount() {
		this.fetchData(this.state.documentURI)
	}

	async componentDidUpdate(prevProps) {
		// Re-fetch if other document was selected
		let documentURI = Object.keys(this.props.selection)[0];
		if (Object.keys(prevProps.selection)[0] !== documentURI) {
			this.fetchData(documentURI)
		}
	}

	async fetchData(documentURI) {
		let contacts = await this.cm.getContacts();
		let permissions = [], commentPermissions = [];
		try {
			permissions = await this.cm.pm.getPermissions(documentURI);
		} catch {}
		try {
			commentPermissions = await this.cm.pm.getPermissions(this.cm.getMetadataURI(documentURI));
		} catch {}
		// If both are not fetchable
		if (!permissions.length) {
			this.setState(state => {
				return {
					userHasControl: false,
					documentURI, contacts,
					permissions, commentPermissions,
					tableData: []
				}
			});
		}
		let tableData = this.createTableData(permissions, commentPermissions, contacts);

		// Check if user has control
		let userHasControl = false;
		let webID = await this.cm.getCurrentWebID();
		for (let row of tableData) {
			if (row.control && row.agent === webID) {
				userHasControl = true;
				break;
			}
		}
		this.setState(state => {
			return {
				userHasControl,
				documentURI, contacts,
				permissions, commentPermissions,
				tableData
			}
		});
	}

  	createTableData(permissions, commentPermissions, contacts) {
		let tableData = []
		let agentIndexes = {}
		let newRow = {
			read: false,
			write: false,
			comment: false,
			control: false
		}
		function processPermission(permission) {
			if (permission.agents === null) {
				permission.agents = [null];
			}
			for (let agent of permission.agents) {
				let index = agentIndexes[agent];
				if (index === undefined) {
					index = tableData.length;
					agentIndexes[agent] = index
					// Set because you can have a permission only once
					tableData.push({
						...newRow,
						agent
					});
				}
				for (let mode of permission.modes) {
					tableData[index][mode.toLowerCase()] = true;
				}
			}
		}
    	for (let permission of permissions) {
			processPermission(permission)
		}
		// comment permissions
		for (let permission of commentPermissions) {
			if (permission.modes.includes(MODES.APPEND) || permission.modes.includes(MODES.WRITE)) {
				permission.modes = [MODES.COMMENT];
				processPermission(permission);
			}
		}
		// Contacs that don't have permission should also be displayed
		for (let contact of contacts) {
			if (agentIndexes[contact] === undefined) {
				agentIndexes[contact] = tableData.length;
				tableData.push({
					...newRow,
					agent: contact
				});
			}
		}
    	return tableData;
	}

	// TODO: check valid webId's, groups, weird permissions (only write, owner no control, ...)
	submitValues() {
		let permissions = [];
		let readAgents = [];
		// Comment is APPEND permission on metafile.
		let commentPermissions = [];

		function addPermission(permissions, agent, modes) {
			if (!modes.length) { return permissions; }
			modes.sort()
			// Always add new if the mode is for everyone
			if (agent === null) {
				permissions.push({ agents: null, modes: modes});
				return permissions;
			}
			for (let permission of permissions) {
				// Assumes permission.modes is sorted
				if (permission.modes.join('') === modes.join('') && permission.agents !== null) {
					permission.agents.push(agent);
					return permissions;
				}
			}
			// Mode does not yet exist
			permissions.push({ agents: [agent], modes: modes });
			return permissions;
		}

		for (let row of this.state.tableData) {  // 'row' is like { agent: 'bob', read: true, write: false ... }
			if (row.comment) {
				commentPermissions = addPermission(commentPermissions, row.agent, [MODES.APPEND]);  // comment is APPEND on metadata file
			}
			let modes = [];
			for (let [mode, access] of [[MODES.READ, row.read], [MODES.WRITE, row.write], [MODES.CONTROL, row.control]]) {
				if (access) { modes.push(mode); }
			}
			permissions = addPermission(permissions, row.agent, modes);
			// All Readers
			if (row.read) {
				if (row.agent === null) {
					readAgents = null;
				} else if (readAgents !== null) {
					readAgents.push(row.agent)
				}
			}
		}

		this.cm.pm.reCreateACL(this.state.documentURI, permissions);
		// All readers of the paper should also be able to read the metafile
		commentPermissions.push(createPermission([MODES.READ], readAgents))
		this.cm.pm.reCreateACL(this.cm.getMetadataURI(this.state.documentURI), commentPermissions);
		// All readers of the paper should also be able to read the parent folder
		let folderName = this.state.documentURI.split('/').slice(0, -1).join('/') + '/'
		if (readAgents === null) {
			this.cm.pm.reCreateACL(folderName, [createPermission([MODES.READ], null)])
		} else {
			this.cm.pm.addToACL(folderName, [createPermission([MODES.READ], readAgents)])
		}
	}

	render() {
		if (!this.state.userHasControl) { return null; }
		return (
			<>
				<p>Permissions for this file</p>
				<AccessControlTable tableData={this.state.tableData}
					submitValues={data => this.setState({ tableData: data }, this.submitValues)} />
			</>
		);
	}
}