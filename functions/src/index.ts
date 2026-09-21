import * as functions from 'firebase-functions/v1'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

export const INCOMING_FRIEND_REQUESTS = 'incomingFriendRequests'
export const OUTGOING_FRIEND_REQUESTS = 'outgoingFriendRequests'
export const FRIENDS = 'friends'

type FriendsStatusType = 'friends' | 'incoming' | 'outgoing' | 'not_friends'

type FriendsData = {
  friendUID: string
  friendUsername: string
  date: number
}

export type UserProfileDataType = {
  createdAt: number
  displayName: string
  photoUrl: string
  username: string
  totalWorkouts: number
  totalExercises: number
  lastActive?: number
}

export type ExercisesServerDataType = {
  id: string
  index: number
  name: string
  originalString: string
  weights: WeightGroupType[]
  workoutDate: number | null
  workoutID: string
}

export type WeightGroupType = {
  sets: number[]
  weight: number
  comment: string
}

export type CombinedFriendsData = FriendsData & UserProfileDataType

initializeApp()
const firestore = getFirestore()

// Friend cloud functions
type SendFriendRequestEmailType = {
  currUID: string
  friendUID: string
  currUsername: string
}
export const sendFriendRequestEmail = functions.https.onCall(
  async (data: SendFriendRequestEmailType, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Only authenticated users can request'
        )
      }
      if (
        !data.currUID ||
        !data.friendUID ||
        context.auth.uid !== data.currUID
      ) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'UID data not provided or invalid'
        )
      }

      const friendData = await getAuth().getUser(data.friendUID)
      const currUserData = await getAuth().getUser(data.currUID)
      const currName = currUserData.displayName
      const currProfilePicture = currUserData.photoURL
      const friendEmail = friendData.email
      const friendName = friendData.displayName

      const to = [friendEmail]
      const message = {
        html: `<body style="background-color: #09090b; margin: 0; padding: 0; font-family: Arial, sans-serif; color: #ffffff;">

    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">
        <tr>
            <td align="center" bgcolor="#17171b" style="padding: 40px;">
                <img src="https://firebasestorage.googleapis.com/v0/b/workout-tracker-69161.appspot.com/o/PumpTrack-logos_white.png?alt=media&token=7e25e8e4-b95c-4713-ba52-2a1b98f6b956" alt="PumpTrack Logo" width="150" style="display: block; margin: 0 auto;">
                <h2 style="color: #855ae1; margin-top: 30px;">Friend Request</h2>
                <p style="margin-top: 20px;">Hello ${friendName},</p>
                <p style="color: #8e8e8e;">You have received a friend request from ${currName} on PumpTrack.</p>

                <!-- Friend Card -->
                <div style="border: 1px solid #555; padding: 20px; margin-top: 30px; text-align: center;">
                    <img src="${currProfilePicture}" alt="Friend's Profile Picture" width="80" style="border-radius: 50%;">
                    <h3 style="color: #855ae1; margin-top: 10px;">${currName}</h3>
                    <p style="color: #8e8e8e;">@${data.currUsername}</p>
                    <a href="https://pumptrack.netlify.app/user/${data.currUsername}" style="display: inline-block; background-color: #855ae1; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">Accept Request</a>
                </div>
                <!-- End of Friend Card -->

                <p style="color: #8e8e8e; margin-top: 20px;">If you have any questions or need assistance, feel free to contact our support team.</p>
                <p style="color: #8e8e8e;">Best regards,</p>
                <p style="color: #8e8e8e;">The PumpTrack Team</p>
            </td>
        </tr>
        <tr>
            <td align="center" bgcolor="#3b3b3f" style="padding: 30px; font-size: 12px; color: rgb(119, 119, 119);">
                <p style="margin: 0;">This email was sent from an automated system. Please do not reply to this email.</p>
                <p style="margin: 10px 0 0;">You are receiving this email because you have a registered account on PumpTrack. If you believe you received this email in error, please disregard it.</p>
            </td>
        </tr>
    </table>

</body>`,
        subject: 'New Friend Request',
        text: `Friend Request

Hello ${friendName},

You have received a friend request from ${currName} on PumpTrack.

Friend's Details:
${currName}
@${data.currUsername}

To accept the request, click the link below:
Accept Request

If you have any questions or need assistance, feel free to contact our support team.

Best regards,
The PumpTrack Team

This email was sent from an automated system. Please do not reply to this email.

You are receiving this email because you have a registered account on PumpTrack. If you believe you received this email in error, please disregard it.`,
      }
      const mailCollection = getFirestore().collection('mail')
      return mailCollection.add({ to, message }).then(res => {
        return 'test'
      })
    } catch (error) {
      console.error('Error sending friend request email:', error)
      throw new functions.https.HttpsError(
        'internal',
        'Error sending friend request email'
      )
    }
  }
)
export const sendFriendAcceptedEmail = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'only authenticated users can request'
      )
    }
    if (!data.currUID || !data.friendUID || context.auth.uid !== data.currUID) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'uid data not provided / invalid'
      )
    }

    const friendData = await getAuth().getUser(data.friendUID)
    const currUserData = await getAuth().getUser(data.currUID)
    const currName = currUserData.displayName
    const currProfilePicture = currUserData.photoURL
    const friendEmail = friendData.email
    const friendName = friendData.displayName

    const to = [friendEmail]
    const message = {
      html: `<body style="background-color: #09090b; margin: 0; padding: 0; font-family: Arial, sans-serif; color: #ffffff;">

              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">
                  <tr>
                      <td align="center" bgcolor="#17171b" style="padding: 40px;">
                          <img src="https://firebasestorage.googleapis.com/v0/b/workout-tracker-69161.appspot.com/o/PumpTrack-logos_white.png?alt=media&token=7e25e8e4-b95c-4713-ba52-2a1b98f6b956" alt="PumpTrack Logo" width="150" style="display: block; margin: 0 auto;">
                          <h2 style="color: #855ae1; margin-top: 30px;">Friend Request</h2>
                          <p style="margin-top: 20px;">Hello ${friendName},</p>
                          <p style="color: #8e8e8e;">You have received a friend request from ${currName} on PumpTrack.</p>

                          <!-- Friend Card -->
                          <div style="border: 1px solid #555; padding: 20px; margin-top: 30px; text-align: center;">
                              <img src="${currProfilePicture}" alt="Friend's Profile Picture" width="80" style="border-radius: 50%;">
                              <h3 style="color: #855ae1; margin-top: 10px;">${currName}</h3>
                              <p style="color: #8e8e8e;">@${data.currUsername}</p>
                              <a href="https://pumptrack.netlify.app/user/${data.currUsername}" style="display: inline-block; background-color: #855ae1; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">Accept Request</a>
                          </div>
                          <!-- End of Friend Card -->

                          <p style="color: #8e8e8e; margin-top: 20px;">If you have any questions or need assistance, feel free to contact our support team.</p>
                          <p style="color: #8e8e8e;">Best regards,</p>
                          <p style="color: #8e8e8e;">The PumpTrack Team</p>
                      </td>
                  </tr>
                  <tr>
                      <td align="center" bgcolor="#3b3b3f" style="padding: 30px; font-size: 12px; color: rgb(119, 119, 119);">
                          <p style="margin: 0;">This email was sent from an automated system. Please do not reply to this email.</p>
                          <p style="margin: 10px 0 0;">You are receiving this email because you have a registered account on PumpTrack. If you believe you received this email in error, please disregard it.</p>
                      </td>
                  </tr>
              </table>

          </body>`,
      subject: 'New Friend Request',
      text: `Friend Request

        Hello ${friendName},

        You have received a friend request from ${currName} on PumpTrack.

        Friend's Details:
        ${currName}
        @${data.currUsername}

        To accept the request, click the link below:
        Accept Request

        If you have any questions or need assistance, feel free to contact our support team.

        Best regards,
        The PumpTrack Team

        This email was sent from an automated system. Please do not reply to this email.

        You are receiving this email because you have a registered account on PumpTrack. If you believe you received this email in error, please disregard it.`,
    }

    const mailCollection = getFirestore().collection('mail')
    return mailCollection.add({ to, message }).then(res => {
      return 'test'
    })
  }
)
export const getNumberOfFriends = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'only authenticated users can request'
      )
    }

    let numFriends = 0
    await firestore
      .doc(`userProfileData/${data.uid}`)
      .get()
      .then(res => {
        const resData = res.data()
        numFriends = resData?.numFriends || 0
      })

    return numFriends
  }
)
const checkIfDocExistsInUserCollection = async (
  collection: FriendsStatusType,
  currUID: string,
  friendUID: string
) => {
  let collectionName: string
  switch (collection) {
    case 'incoming':
    case 'outgoing':
      collectionName = collection + 'FriendRequests'
      break
    default:
      collectionName = collection
  }

  const docRef = firestore.doc(
    `userProfileData/${currUID}/${collectionName}/${friendUID}`
  )
  const docSnapshot = await docRef.get()

  if (docSnapshot.exists) {
    return true
  }

  return false
}
export const checkIfFriends = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'only authenticated users can request'
    )
  }
  if (!data.currUID || !data.friendUID) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'currUID and friendUID must be provided'
    )
  }

  return await checkIfDocExistsInUserCollection(
    'friends',
    data.currUID,
    data.friendUID
  )
})
export const getFriendshipStatusFunc = async (
  currUID: string,
  friendUID: string
): Promise<FriendsStatusType> => {
  let status: FriendsStatusType

  if (await checkIfDocExistsInUserCollection('friends', currUID, friendUID)) {
    status = 'friends'
  } else if (
    await checkIfDocExistsInUserCollection('outgoing', currUID, friendUID)
  ) {
    status = 'outgoing'
  } else if (
    await checkIfDocExistsInUserCollection('incoming', currUID, friendUID)
  ) {
    status = 'incoming'
  } else {
    status = 'not_friends'
  }

  return status
}
export const getFriendshipStatus = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'only authenticated users can request'
      )
    }
    const currUID = data.currUID
    const friendUID = data.friendUID
    if (!currUID || !friendUID) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'currUID and friendUID must be provided'
      )
    }

    let status: FriendsStatusType

    if (await checkIfDocExistsInUserCollection('friends', currUID, friendUID)) {
      status = 'friends'
    } else if (
      await checkIfDocExistsInUserCollection('outgoing', currUID, friendUID)
    ) {
      status = 'outgoing'
    } else if (
      await checkIfDocExistsInUserCollection('incoming', currUID, friendUID)
    ) {
      status = 'incoming'
    } else {
      status = 'not_friends'
    }

    return status
  }
)
export const addFriend = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'only authenticated users can request'
    )
  }

  const currUID = data.currUID
  const friendUID = data.friendUID
  const currUsername = data.currUsername
  const friendUsername = data.friendUsername

  if (!friendUID || !friendUsername || !currUID || !friendUsername) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'friendUID, friendUsername, friendUsername and currUID must all be provided'
    )
  }

  const isFriends = await checkIfDocExistsInUserCollection(
    'friends',
    currUID,
    friendUID
  )
  if (isFriends) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'users are already friends'
    )
  }

  const isOutgoing = await checkIfDocExistsInUserCollection(
    'outgoing',
    currUID,
    friendUID
  )
  if (isOutgoing) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'friendship already pending, please refresh'
    )
  }

  const isIncoming = await checkIfDocExistsInUserCollection(
    'incoming',
    currUID,
    friendUID
  )
  if (isIncoming) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'friendship already requested, please refresh'
    )
  }

  const date = new Date().getTime()

  const friendsData: FriendsData = {
    friendUID,
    friendUsername: friendUsername,
    date: date,
  }

  const currUsersData: FriendsData = {
    friendUID: currUID,
    friendUsername: currUsername,
    date: date,
  }

  await firestore
    .doc(`userProfileData/${currUID}/${OUTGOING_FRIEND_REQUESTS}/${friendUID}`)
    .set({ ...friendsData })
  await firestore
    .doc(`userProfileData/${friendUID}/${INCOMING_FRIEND_REQUESTS}/${currUID}`)
    .set({ ...currUsersData })
})
export const removeFriend = functions.https.onCall(async (data, context) => {
  const currUID = data.currUID
  const friendUID = data.friendUID

  if (!context.auth || context.auth.uid !== currUID) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'only authenticated users can request'
    )
  }

  if (!friendUID || !currUID) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'friendUID and currUID must be provided'
    )
  }

  const isFriends = await checkIfDocExistsInUserCollection(
    'friends',
    currUID,
    friendUID
  )
  if (!isFriends) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'users are not friends'
    )
  }

  await firestore
    .doc(`userProfileData/${currUID}/${FRIENDS}/${friendUID}`)
    .delete()
  const currUserDocRef = firestore.doc(`userProfileData/${currUID}`)
  currUserDocRef.set(
    {
      numFriends: FieldValue.increment(-1),
    },
    { merge: true }
  )
  await firestore
    .doc(`userProfileData/${friendUID}/${FRIENDS}/${currUID}`)
    .delete()
  const friendDocRef = firestore.doc(`userProfileData/${friendUID}`)
  friendDocRef.set(
    {
      numFriends: FieldValue.increment(-1),
    },
    { merge: true }
  )
})
export const acceptFriendRequest = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'only authenticated users can request'
      )
    }

    const currUID = data.currUID
    const friendUID = data.friendUID
    const friendUsername = data.friendUsername
    const currUsername = data.currUsername

    if (!friendUID || !friendUsername || !currUID || !currUsername) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'friendUID, friendUsername, currUID and currUsername must all be provided'
      )
    }

    const isFriends = await checkIfDocExistsInUserCollection(
      'friends',
      currUID,
      friendUID
    )
    if (isFriends) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'users are already friends'
      )
    }
    const isIncoming = await checkIfDocExistsInUserCollection(
      'incoming',
      currUID,
      friendUID
    )
    if (!isIncoming) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'must have requested friend in order to accept'
      )
    }

    const date = new Date().getTime()

    const incomingFriendData: FriendsData = {
      friendUID: data.friendUID,
      friendUsername: data.friendUsername,
      date,
    }
    const outgoingFriendData: FriendsData = {
      friendUID: currUID,
      friendUsername: currUsername,
      date,
    }

    // update current user
    await firestore
      .doc(`userProfileData/${currUID}/${FRIENDS}/${friendUID}`)
      .set({ ...incomingFriendData })
    const currUserDocRef = firestore.doc(`userProfileData/${currUID}`)
    currUserDocRef.set(
      {
        numFriends: FieldValue.increment(1),
      },
      { merge: true }
    )
    firestore
      .doc(
        `userProfileData/${currUID}/${INCOMING_FRIEND_REQUESTS}/${friendUID}`
      )
      .delete()

    // update friend
    await firestore
      .doc(`userProfileData/${friendUID}/${FRIENDS}/${currUID}`)
      .set({ ...outgoingFriendData })
    const friendDocRef = firestore.doc(`userProfileData/${friendUID}`)
    friendDocRef.set(
      {
        numFriends: FieldValue.increment(1),
      },
      { merge: true }
    )
    firestore
      .doc(
        `userProfileData/${friendUID}/${OUTGOING_FRIEND_REQUESTS}/${currUID}`
      )
      .delete()

    return 'test'
  }
)
export const getSuggestedFriends = functions.https.onCall(
  async (data, context) => {
    const uid = data.uid
    if (!uid) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'uid must be passed through data object'
      )
    }
    if (!context.auth || context.auth.uid !== uid) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'only authenticated users can request'
      )
    }

    const profilesCollection = firestore.collection('userProfileData')

    const friendsList = []

    let lastDoc
    while (friendsList.length < 6) {
      const currLimit: number = 6 - friendsList.length
      let friendsQ = profilesCollection
        .where('lastActive', '>', 0)
        .orderBy('lastActive', 'desc')
        .limit(currLimit)

      if (lastDoc) {
        friendsQ = friendsQ.startAfter(lastDoc)
      }

      const querySnapshot = await friendsQ.get()

      if (querySnapshot.empty) {
        break
      }

      for (const userDoc of querySnapshot.docs) {
        const friendUID = userDoc.id

        if (friendUID === uid) {
          continue
        }

        const friendStatus = await getFriendshipStatusFunc(uid, friendUID)
        if (friendStatus === 'not_friends') {
          const userData = userDoc.data()
          friendsList.push(userData)
        }
      }

      const docsLength = querySnapshot.docs.length
      if (docsLength < currLimit) {
        break
      }

      lastDoc = querySnapshot.docs[docsLength - 1]
    }

    return friendsList
  }
)
export const removeIncomingRequest = functions.https.onCall(
  async (data, context) => {
    const currUID = data.currUID
    const friendUID = data.friendUID
    if (!currUID || !friendUID) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'currUID and friendUID must be passed through data object'
      )
    }
    if (!context.auth || context.auth.uid !== currUID) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'only authenticated users can request'
      )
    }

    firestore
      .doc(
        `userProfileData/${currUID}/${INCOMING_FRIEND_REQUESTS}/${friendUID}`
      )
      .delete()
    firestore
      .doc(
        `userProfileData/${friendUID}/${OUTGOING_FRIEND_REQUESTS}/${currUID}`
      )
      .delete()
    return 'test'
  }
)
export const removeOutgoingRequest = functions.https.onCall(
  async (data, context) => {
    const currUID = data.currUID
    const friendUID = data.friendUID
    if (!currUID || !friendUID) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'currUID and friendUID must be passed through data object'
      )
    }
    if (!context.auth || context.auth.uid !== currUID) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'only authenticated users can request'
      )
    }

    firestore
      .doc(
        `userProfileData/${currUID}/${OUTGOING_FRIEND_REQUESTS}/${friendUID}`
      )
      .delete()
    firestore
      .doc(
        `userProfileData/${friendUID}/${INCOMING_FRIEND_REQUESTS}/${currUID}`
      )
      .delete()

    return 'test'
  }
)

export const getUsersFriendData = functions.https.onCall(
  async (data: { usersFriendList: FriendsData[] }, context) => {
    const usersFriendList: FriendsData[] = data.usersFriendList
    if (!usersFriendList) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'usersFriendList must be passed through data object'
      )
    }

    const combinedUserData: CombinedFriendsData[] = await Promise.all(
      usersFriendList.map(
        async (friend: FriendsData): Promise<CombinedFriendsData> => {
          const friendUID = friend.friendUID
          const userDoc = await firestore
            .doc(`userProfileData/${friendUID}`)
            .get()
          const userProfileData = userDoc.data() as UserProfileDataType
          const result: CombinedFriendsData = {
            ...friend,
            ...userProfileData,
          }
          return result
        }
      )
    )

    return combinedUserData
  }
)

// User cloud functions
export const updateActivity = functions.https.onCall((data, context) => {
  const uid = data.uid
  if (!context.auth || context.auth.uid !== uid) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'only authenticated users can request'
    )
  }

  firestore.doc(`userProfileData/${uid}`).update({
    lastActive: new Date().getTime(),
  })
})

// Workout cloud functions
export const updateTotalWorkoutsAndExercises = functions.https.onCall(
  (data, context) => {
    const uid = data.uid
    if (!context.auth || context.auth.uid !== uid) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'only authenticated users can request'
      )
    }

    const numWorkouts: number = Number(data.numWorkouts) || 0
    const numExercises: number = Number(data.numExercises) || 0

    firestore.doc(`userProfileData/${uid}`).update({
      totalWorkouts: FieldValue.increment(numWorkouts),
      totalExercises: FieldValue.increment(numExercises),
    })
  }
)

// export const updateExerciseMaxWeight = functions.https.onCall(async () => {
//   const usersDataCollection = getFirestore().collection('usersData')
//   const usersDataDocs = await usersDataCollection.listDocuments()

//   for (const usersDataDoc of usersDataDocs) {
//     const exercisesCollection = usersDataDoc.collection('exercises')
//     const exerciseDocs = await exercisesCollection.listDocuments()

//     for (const exerciseDoc of exerciseDocs) {
//       const exerciseData = (
//         await exerciseDoc.get()
//       ).data() as ExercisesServerDataType
//       const weights = exerciseData?.weights || ([] as WeightGroupType[])

//       if (weights.length === 0) {
//         console.error('No weights found for the exercise')
//         continue
//       }

//       const maxWeight = calculateMaxWeight(weights)

//       console.log(exerciseData, maxWeight)
//       await exerciseDoc.update({ maxWeight: maxWeight })
//     }
//   }

//   // firestore.doc(`userProfileData/${uid}`).update({
//   //   totalWorkouts: FieldValue.increment(numWorkouts),
//   //   totalExercises: FieldValue.increment(numExercises),
//   // })
// })
// const calculateMaxWeight = (weights: WeightGroupType[]) => {
//   let maxWeight = 0

//   weights.forEach(weightGroup => {
//     if (weightGroup.weight > maxWeight) {
//       maxWeight = weightGroup.weight
//     }
//   })

//   return maxWeight
// }
