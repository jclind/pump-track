import * as functions from 'firebase-functions/v1'
import { initializeApp } from 'firebase-admin/app'
import {
  getFirestore,
  FieldValue,
  DocumentSnapshot,
  Transaction,
} from 'firebase-admin/firestore'
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

export type CombinedFriendsData = FriendsData & UserProfileDataType

initializeApp()
const firestore = getFirestore()

const MAX_UID_LENGTH = 128
const MAX_FRIEND_LIST = 50
const SUGGESTED_FRIENDS = 6
const SUGGESTED_PAGE_SIZE = 20
const SUGGESTED_MAX_SCANNED = 60
const MAX_COUNT_CHANGE = 1000
const REQUEST_EMAIL_GAP_MS = 24 * 60 * 60 * 1000

// Names and usernames come from users, so escape them before they go into
// email HTML.
const escapeHtml = (value: string | null | undefined) =>
  (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const requireAuth = (context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'only authenticated users can request'
    )
  }
  return context.auth
}

const requireCaller = (
  context: functions.https.CallableContext,
  uid: unknown
) => {
  const auth = requireAuth(context)
  if (auth.uid !== uid) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'uid does not match the signed-in user'
    )
  }
}

// A uid ends up in a document path, so it can't hold a slash or be a name
// Firestore reserves.
const isValidUID = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= MAX_UID_LENGTH &&
  !value.includes('/') &&
  value !== '.' &&
  value !== '..' &&
  !/^__.*__$/.test(value)

const requireUID = (value: unknown, name: string): string => {
  if (!isValidUID(value)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `${name} is missing or not valid`
    )
  }
  return value
}

// Checks sign-in, then the arguments, then that currUID is the caller.
const requireFriendPair = (
  data: any,
  context: functions.https.CallableContext
) => {
  requireAuth(context)
  const currUID = requireUID(data?.currUID, 'currUID')
  const friendUID = requireUID(data?.friendUID, 'friendUID')
  requireCaller(context, currUID)
  return { currUID, friendUID }
}

const rejectSelf = (currUID: string, friendUID: string) => {
  if (currUID === friendUID) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'cannot friend yourself'
    )
  }
}

const profileRef = (uid: string) => firestore.doc(`userProfileData/${uid}`)
const relationRef = (uid: string, collection: string, otherUID: string) =>
  firestore.doc(`userProfileData/${uid}/${collection}/${otherUID}`)
// When currUID last had a request email sent to friendUID. No rule matches
// this collection, so only the functions can read or write it.
const requestEmailLogRef = (currUID: string, friendUID: string) =>
  firestore.doc(`friendRequestEmailLog/${currUID}_${friendUID}`)

const publicProfile = (
  data: FirebaseFirestore.DocumentData | undefined
): UserProfileDataType => ({
  createdAt: data?.createdAt,
  displayName: data?.displayName ?? '',
  photoUrl: data?.photoUrl ?? '',
  username: data?.username ?? '',
  totalWorkouts: data?.totalWorkouts ?? 0,
  totalExercises: data?.totalExercises ?? 0,
  lastActive: data?.lastActive,
})

// The profile holds the username; older accounts may only have it in the
// usernames collection.
const lookupUsername = async (
  transaction: Transaction,
  uid: string,
  profile: DocumentSnapshot
): Promise<string> => {
  const fromProfile = profile.data()?.username
  if (typeof fromProfile === 'string' && fromProfile) return fromProfile
  const owned = await transaction.get(
    firestore.collection('usernames').where('uid', '==', uid).limit(1)
  )
  return owned.empty ? '' : owned.docs[0].id
}

const requireUsername = (username: string) => {
  if (!username) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'user has no username'
    )
  }
  return username
}

// Friend emails
type FriendEmailKind = 'request' | 'accepted'

const FRIEND_EMAIL_COPY: Record<
  FriendEmailKind,
  {
    subject: string
    heading: string
    intro: (name: string) => string
    button: string
  }
> = {
  request: {
    subject: 'New Friend Request',
    heading: 'Friend Request',
    intro: name => `You have received a friend request from ${name} on PumpTrack.`,
    button: 'Accept Request',
  },
  accepted: {
    subject: 'Friend Request Accepted',
    heading: 'Friend Request Accepted',
    intro: name => `${name} accepted your friend request on PumpTrack.`,
    button: 'View Profile',
  },
}

const buildFriendEmail = (
  kind: FriendEmailKind,
  recipientName: string,
  senderName: string,
  senderUsername: string,
  senderPhoto: string
) => {
  const copy = FRIEND_EMAIL_COPY[kind]
  const profileUrl = `https://pumptrack.netlify.app/user/${encodeURIComponent(
    senderUsername
  )}`
  const htmlSenderName = escapeHtml(senderName)

  const html = `<body style="background-color: #09090b; margin: 0; padding: 0; font-family: Arial, sans-serif; color: #ffffff;">

    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">
        <tr>
            <td align="center" bgcolor="#17171b" style="padding: 40px;">
                <img src="https://firebasestorage.googleapis.com/v0/b/workout-tracker-69161.appspot.com/o/PumpTrack-logos_white.png?alt=media&token=7e25e8e4-b95c-4713-ba52-2a1b98f6b956" alt="PumpTrack Logo" width="150" style="display: block; margin: 0 auto;">
                <h2 style="color: #855ae1; margin-top: 30px;">${copy.heading}</h2>
                <p style="margin-top: 20px;">Hello ${escapeHtml(recipientName)},</p>
                <p style="color: #8e8e8e;">${copy.intro(htmlSenderName)}</p>

                <div style="border: 1px solid #555; padding: 20px; margin-top: 30px; text-align: center;">
                    <img src="${escapeHtml(senderPhoto)}" alt="Friend's Profile Picture" width="80" style="border-radius: 50%;">
                    <h3 style="color: #855ae1; margin-top: 10px;">${htmlSenderName}</h3>
                    <p style="color: #8e8e8e;">@${escapeHtml(senderUsername)}</p>
                    <a href="${escapeHtml(profileUrl)}" style="display: inline-block; background-color: #855ae1; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">${copy.button}</a>
                </div>

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

</body>`

  const text = `${copy.heading}

Hello ${recipientName},

${copy.intro(senderName)}

${senderName}
@${senderUsername}

${copy.button}: ${profileUrl}

If you have any questions or need assistance, feel free to contact our support team.

Best regards,
The PumpTrack Team

This email was sent from an automated system. Please do not reply to this email.

You are receiving this email because you have a registered account on PumpTrack. If you believe you received this email in error, please disregard it.`

  return { subject: copy.subject, html, text }
}

// Called only after the friend operation has committed. A failed email is
// logged and never fails the operation.
const sendFriendEmail = async (
  kind: FriendEmailKind,
  senderUID: string,
  recipientUID: string,
  senderUsername: string
) => {
  try {
    const [recipient, sender] = await Promise.all([
      getAuth().getUser(recipientUID),
      getAuth().getUser(senderUID),
    ])
    if (!recipient.email) return
    const message = buildFriendEmail(
      kind,
      recipient.displayName ?? '',
      sender.displayName ?? '',
      senderUsername,
      sender.photoURL ?? ''
    )
    await firestore.collection('mail').add({ to: [recipient.email], message })
  } catch (error) {
    console.error(`Error sending friend ${kind} email:`, error)
  }
}

// Friend cloud functions

// addFriend and acceptFriendRequest send these emails now. Deployed clients
// still call these two after each, so they stay as no-ops.
export const sendFriendRequestEmail = functions.https.onCall(
  async (_data, context) => {
    requireAuth(context)
    return null
  }
)
export const sendFriendAcceptedEmail = functions.https.onCall(
  async (_data, context) => {
    requireAuth(context)
    return null
  }
)

export const getNumberOfFriends = functions.https.onCall(
  async (data, context) => {
    requireCaller(context, data?.uid)
    const uid = requireUID(data.uid, 'uid')

    const profile = await profileRef(uid).get()
    return profile.data()?.numFriends || 0
  }
)

const relationRefs = (currUID: string, friendUID: string) => [
  relationRef(currUID, FRIENDS, friendUID),
  relationRef(currUID, OUTGOING_FRIEND_REQUESTS, friendUID),
  relationRef(currUID, INCOMING_FRIEND_REQUESTS, friendUID),
]

// Takes the snapshots of relationRefs, in that order.
const statusFromSnapshots = (
  snapshots: DocumentSnapshot[]
): FriendsStatusType => {
  const [friends, outgoing, incoming] = snapshots
  if (friends.exists) return 'friends'
  if (outgoing.exists) return 'outgoing'
  if (incoming.exists) return 'incoming'
  return 'not_friends'
}

export const getFriendshipStatusFunc = async (
  currUID: string,
  friendUID: string
): Promise<FriendsStatusType> =>
  statusFromSnapshots(
    await firestore.getAll(...relationRefs(currUID, friendUID))
  )

export const checkIfFriends = functions.https.onCall(async (data, context) => {
  const { currUID, friendUID } = requireFriendPair(data, context)
  const friendsDoc = await relationRef(currUID, FRIENDS, friendUID).get()
  return friendsDoc.exists
})

export const getFriendshipStatus = functions.https.onCall(
  async (data, context) => {
    const { currUID, friendUID } = requireFriendPair(data, context)
    return getFriendshipStatusFunc(currUID, friendUID)
  }
)

// The client also sends currUsername and friendUsername. They are ignored;
// the usernames come from the database.
export const addFriend = functions.https.onCall(async (data, context) => {
  const { currUID, friendUID } = requireFriendPair(data, context)
  rejectSelf(currUID, friendUID)

  const outgoingRef = relationRef(currUID, OUTGOING_FRIEND_REQUESTS, friendUID)
  const incomingRef = relationRef(friendUID, INCOMING_FRIEND_REQUESTS, currUID)

  const emailLogRef = requestEmailLogRef(currUID, friendUID)

  const result = await firestore.runTransaction(async transaction => {
    const [currProfile, friendProfile, emailLog, ...relations] =
      await transaction.getAll(
        profileRef(currUID),
        profileRef(friendUID),
        emailLogRef,
        ...relationRefs(currUID, friendUID)
      )
    if (!friendProfile.exists) {
      throw new functions.https.HttpsError('not-found', 'user does not exist')
    }
    const status = statusFromSnapshots(relations)
    if (status === 'friends') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'users are already friends'
      )
    }
    if (status === 'outgoing') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'friendship already pending, please refresh'
      )
    }
    if (status === 'incoming') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'friendship already requested, please refresh'
      )
    }

    const currName = requireUsername(
      await lookupUsername(transaction, currUID, currProfile)
    )
    const friendName = requireUsername(
      await lookupUsername(transaction, friendUID, friendProfile)
    )

    const date = new Date().getTime()
    const outgoing: FriendsData = {
      friendUID,
      friendUsername: friendName,
      date,
    }
    const incoming: FriendsData = {
      friendUID: currUID,
      friendUsername: currName,
      date,
    }
    transaction.set(outgoingRef, outgoing)
    transaction.set(incomingRef, incoming)

    // Sending, cancelling and sending again would email the same person
    // every time, so one request email per pair per day.
    const lastSent = emailLog.data()?.sentAt
    const shouldEmail =
      typeof lastSent !== 'number' || date - lastSent >= REQUEST_EMAIL_GAP_MS
    if (shouldEmail) transaction.set(emailLogRef, { sentAt: date })
    return { currName, shouldEmail }
  })

  if (result.shouldEmail) {
    await sendFriendEmail('request', currUID, friendUID, result.currName)
  }
})

export const removeFriend = functions.https.onCall(async (data, context) => {
  const { currUID, friendUID } = requireFriendPair(data, context)

  const currFriendRef = relationRef(currUID, FRIENDS, friendUID)
  const friendFriendRef = relationRef(friendUID, FRIENDS, currUID)

  await firestore.runTransaction(async transaction => {
    const [currFriend, friendFriend, currProfile, friendProfile] =
      await transaction.getAll(
        currFriendRef,
        friendFriendRef,
        profileRef(currUID),
        profileRef(friendUID)
      )
    if (!currFriend.exists) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'users are not friends'
      )
    }

    transaction.delete(currFriendRef)
    if (currProfile.exists) {
      transaction.update(currProfile.ref, {
        numFriends: FieldValue.increment(-1),
      })
    }
    // Only count down a side that was actually there.
    if (friendFriend.exists) {
      transaction.delete(friendFriendRef)
      if (friendProfile.exists) {
        transaction.update(friendProfile.ref, {
          numFriends: FieldValue.increment(-1),
        })
      }
    }
  })
})

// The client also sends currUsername and friendUsername. They are ignored.
export const acceptFriendRequest = functions.https.onCall(
  async (data, context) => {
    const { currUID, friendUID } = requireFriendPair(data, context)
    rejectSelf(currUID, friendUID)

    const currFriendRef = relationRef(currUID, FRIENDS, friendUID)
    const friendFriendRef = relationRef(friendUID, FRIENDS, currUID)
    const incomingRef = relationRef(currUID, INCOMING_FRIEND_REQUESTS, friendUID)
    const outgoingRef = relationRef(friendUID, OUTGOING_FRIEND_REQUESTS, currUID)

    const currUsername = await firestore.runTransaction(async transaction => {
      const [currProfile, friendProfile, currFriend, friendFriend, incoming] =
        await transaction.getAll(
          profileRef(currUID),
          profileRef(friendUID),
          currFriendRef,
          friendFriendRef,
          incomingRef
        )
      if (currFriend.exists) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'users are already friends'
        )
      }
      if (!incoming.exists) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'must have requested friend in order to accept'
        )
      }
      if (!friendProfile.exists) {
        throw new functions.https.HttpsError('not-found', 'user does not exist')
      }

      const currName = requireUsername(
        await lookupUsername(transaction, currUID, currProfile)
      )
      const friendName = requireUsername(
        await lookupUsername(transaction, friendUID, friendProfile)
      )

      const date = new Date().getTime()
      const currSide: FriendsData = {
        friendUID,
        friendUsername: friendName,
        date,
      }
      const friendSide: FriendsData = {
        friendUID: currUID,
        friendUsername: currName,
        date,
      }

      transaction.set(currFriendRef, currSide)
      if (currProfile.exists) {
        transaction.update(currProfile.ref, {
          numFriends: FieldValue.increment(1),
        })
      }
      transaction.delete(incomingRef)

      transaction.set(friendFriendRef, friendSide)
      if (!friendFriend.exists) {
        transaction.update(friendProfile.ref, {
          numFriends: FieldValue.increment(1),
        })
      }
      transaction.delete(outgoingRef)
      return currName
    })

    await sendFriendEmail('accepted', currUID, friendUID, currUsername)
  }
)

// Up to six recently active users the caller has no relation with. Reads at
// most SUGGESTED_MAX_SCANNED profiles.
export const getSuggestedFriends = functions.https.onCall(
  async (data, context) => {
    requireAuth(context)
    const uid = requireUID(data?.uid, 'uid')
    requireCaller(context, uid)

    const suggestions: UserProfileDataType[] = []
    let scanned = 0
    let lastDoc: DocumentSnapshot | undefined

    while (
      suggestions.length < SUGGESTED_FRIENDS &&
      scanned < SUGGESTED_MAX_SCANNED
    ) {
      let pageQuery = firestore
        .collection('userProfileData')
        .where('lastActive', '>', 0)
        .orderBy('lastActive', 'desc')
        .limit(Math.min(SUGGESTED_PAGE_SIZE, SUGGESTED_MAX_SCANNED - scanned))
      if (lastDoc) {
        pageQuery = pageQuery.startAfter(lastDoc)
      }
      const page = await pageQuery.get()
      if (page.empty) break
      scanned += page.docs.length

      const candidates = page.docs.filter(doc => doc.id !== uid)
      const relations = candidates.length
        ? await firestore.getAll(
            ...candidates.flatMap(doc => relationRefs(uid, doc.id))
          )
        : []
      candidates.forEach((doc, i) => {
        if (suggestions.length >= SUGGESTED_FRIENDS) return
        const status = statusFromSnapshots(relations.slice(i * 3, i * 3 + 3))
        if (status === 'not_friends') {
          suggestions.push(publicProfile(doc.data()))
        }
      })

      if (page.docs.length < SUGGESTED_PAGE_SIZE) break
      lastDoc = page.docs[page.docs.length - 1]
    }

    return suggestions
  }
)

export const removeIncomingRequest = functions.https.onCall(
  async (data, context) => {
    const { currUID, friendUID } = requireFriendPair(data, context)

    const batch = firestore.batch()
    batch.delete(relationRef(currUID, INCOMING_FRIEND_REQUESTS, friendUID))
    batch.delete(relationRef(friendUID, OUTGOING_FRIEND_REQUESTS, currUID))
    await batch.commit()
  }
)
export const removeOutgoingRequest = functions.https.onCall(
  async (data, context) => {
    const { currUID, friendUID } = requireFriendPair(data, context)

    const batch = firestore.batch()
    batch.delete(relationRef(currUID, OUTGOING_FRIEND_REQUESTS, friendUID))
    batch.delete(relationRef(friendUID, INCOMING_FRIEND_REQUESTS, currUID))
    await batch.commit()
  }
)

export const getUsersFriendData = functions.https.onCall(
  async (data: { usersFriendList: FriendsData[] }, context) => {
    requireAuth(context)
    const usersFriendList: unknown = data?.usersFriendList
    if (
      !Array.isArray(usersFriendList) ||
      usersFriendList.length > MAX_FRIEND_LIST ||
      !usersFriendList.every(friend => isValidUID(friend?.friendUID))
    ) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `usersFriendList must be a list of at most ${MAX_FRIEND_LIST} friends`
      )
    }
    const friends = usersFriendList as FriendsData[]
    if (friends.length === 0) return []

    const profiles = await firestore.getAll(
      ...friends.map(friend => profileRef(friend.friendUID))
    )

    const combined: CombinedFriendsData[] = []
    friends.forEach((friend, i) => {
      if (!profiles[i].exists) return
      combined.push({
        friendUID: friend.friendUID,
        friendUsername: friend.friendUsername,
        date: friend.date,
        ...publicProfile(profiles[i].data()),
      })
    })
    return combined
  }
)

// Firestore's NOT_FOUND, thrown by update() on a missing doc.
const NOT_FOUND = 5
const updateProfileIfExists = async (
  uid: string,
  update: Record<string, unknown>
) => {
  try {
    await profileRef(uid).update(update)
  } catch (error: any) {
    if (error?.code !== NOT_FOUND) throw error
  }
}

// User cloud functions
export const updateActivity = functions.https.onCall(async (data, context) => {
  requireCaller(context, data?.uid)
  await updateProfileIfExists(data.uid, { lastActive: new Date().getTime() })
})

// Claims a username for the caller and releases any username they held
// before, in one transaction so two callers can't take the same name.
export const setUsername = functions.https.onCall(async (data, context) => {
  const { uid } = requireAuth(context)
  const username = data?.username
  // A Firestore doc id can't contain a slash, be . or .., or match __.*__
  if (
    typeof username !== 'string' ||
    username.length === 0 ||
    username.length > 100 ||
    username.includes('/') ||
    username === '.' ||
    username === '..' ||
    /^__.*__$/.test(username)
  ) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'username is not valid'
    )
  }

  const usernamesCollection = firestore.collection('usernames')
  const newDocRef = usernamesCollection.doc(username)

  await firestore.runTransaction(async transaction => {
    const newDoc = await transaction.get(newDocRef)
    const ownedDocs = await transaction.get(
      usernamesCollection.where('uid', '==', uid)
    )
    if (newDoc.exists) {
      if (newDoc.data()?.uid === uid) return
      throw new functions.https.HttpsError(
        'already-exists',
        'username is taken'
      )
    }
    ownedDocs.docs.forEach(ownedDoc => transaction.delete(ownedDoc.ref))
    transaction.set(newDocRef, { uid })
  })
})

// The client reports these counts, so keep each call to a sane whole number.
const clampCount = (value: unknown) => {
  const n = Math.trunc(Number(value))
  if (!Number.isFinite(n)) return 0
  return Math.max(-MAX_COUNT_CHANGE, Math.min(MAX_COUNT_CHANGE, n))
}

// Workout cloud functions
export const updateTotalWorkoutsAndExercises = functions.https.onCall(
  async (data, context) => {
    requireCaller(context, data?.uid)

    const numWorkouts = clampCount(data.numWorkouts)
    const numExercises = clampCount(data.numExercises)
    if (numWorkouts === 0 && numExercises === 0) return

    await updateProfileIfExists(data.uid, {
      totalWorkouts: FieldValue.increment(numWorkouts),
      totalExercises: FieldValue.increment(numExercises),
    })
  }
)
