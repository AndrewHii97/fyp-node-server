const admin = require('firebase-admin');

var serviceAccount = require("./fyp-project-1deb6-firebase-adminsdk-8xvnc-8a0fcf3fc1.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


function sendPushNotification(alert,tokenList){
	console.log(tokenList)
	
	let registrationToken = []
	tokenList.forEach((tok) =>{
		registrationToken.push(tok.token);
	})
	let message = {
		notification : {
			title: `Alert-${alert.description}`,
			body: `Date: ${alert.issuedate}\nTime: ${alert.issuetime}`
		},
		webpush: {
			fcmOptions: {
				link: 'http://localhost:4200/home/alert'
			}
		},
		data: {alert : alert.description},
		tokens: registrationToken
	};
	admin.messaging().sendMulticast(message)
		.then((response)=>{
			console.log(response.successCount + ' messages is sent succesfully');
		})
}

module.exports = { 
	sendPushNotification
}

