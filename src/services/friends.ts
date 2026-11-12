import {
  DocumentData,
  QueryDocumentSnapshot,
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
} from 'firebase/firestore'
import { getUIDFromUsername, getUsername } from './auth'
import { auth, db, firebaseFunctions } from './firestore'
import { CombinedFriendsData, FriendsData, UserProfileDataType } from '../types'
import { toast } from 'react-hot-toast'
import { httpsCallable } from 'firebase/functions'
import {
  FRIENDS,
  INCOMING_FRIEND_REQUESTS,
  OUTGOING_FRIEND_REQUESTS,
} from '../assets/globalVars/userProfileCollections'

export const getFriendshipStatus = async (friendUsername: string) => {
  const currUID = auth?.currentUser?.uid
  const friendUID = await getUIDFromUsername(friendUsername)

  if (currUID && friendUID) {
    const cloudGetFriendshipStatus = httpsCallable(
      firebaseFunctions,
      'getFriendshipStatus'
    )
    const statusRes: any = await cloudGetFriendshipStatus({
      currUID,
      friendUID,
    })

    const status = statusRes.data

    if (['friends', 'incoming', 'outgoing', 'not_friends'].includes(status)) {
      return status
    }
    return undefined
  }
}
export const addFriend = async (friendUsername: string) => {
  const uid = auth?.currentUser?.uid
  const currUsername = await getUsername()
  const friendUID: string = await getUIDFromUsername(friendUsername)
  if (uid && friendUID && currUsername) {
    try {
      const cloudAddFriend = httpsCallable(firebaseFunctions, 'addFriend')
      await cloudAddFriend({
        currUID: uid,
        friendUID,
        currUsername,
        friendUsername,
      })
      const sendFriendMail = httpsCallable(
        firebaseFunctions,
        'sendFriendRequestEmail'
      )
      sendFriendMail({ currUID: uid, friendUID, currUsername })
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}
export const removeFriend = async (friendUID: string) => {
  try {
    const uid = auth?.currentUser?.uid
    if (uid) {
      const cloudRemoveFriend = httpsCallable(firebaseFunctions, 'removeFriend')
      cloudRemoveFriend({ currUID: uid, friendUID })
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  } catch (error: any) {
    const message = error.message || error
    console.log(error)
    toast.error(message, { position: 'bottom-center' })
  }
}
export const acceptFriendRequest = async (friendUsername: string) => {
  const currUID = auth?.currentUser?.uid
  const currUsername = await getUsername()
  const friendUID = await getUIDFromUsername(friendUsername)

  if (currUID && friendUID && currUsername) {
    try {
      const cloudAcceptFriendRequest = httpsCallable(
        firebaseFunctions,
        'acceptFriendRequest'
      )
      cloudAcceptFriendRequest({
        currUID,
        currUsername,
        friendUID,
        friendUsername,
      }).then(() => {
        const sendFriendAcceptedEmail = httpsCallable(
          firebaseFunctions,
          'sendFriendAcceptedEmail'
        )
        sendFriendAcceptedEmail({ currUID, friendUID, currUsername })
      })
    } catch (error: any) {
      const message = error.message || error
      console.log(error)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}
export const removeIncomingRequest = async (friendUsername: string) => {
  try {
    const uid = auth?.currentUser?.uid
    const friendUID = await getUIDFromUsername(friendUsername)
    if (uid && friendUID) {
      const cloudRemoveIncomingRequest = httpsCallable(
        firebaseFunctions,
        'removeIncomingRequest'
      )
      cloudRemoveIncomingRequest({ currUID: uid, friendUID })
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  } catch (error: any) {
    const message = error.message || error
    console.log(error)
    toast.error(message, { position: 'bottom-center' })
  }
}

const getListFromFriendsCollection = async (
  uid: string,
  collectionName: string,
  limitNum: number,
  lastDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null = null
): Promise<
  | {
      friends: FriendsData[]
      numFriends: number
      newLastDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null
    }
  | undefined
> => {
  try {
    const userProfileRef = doc(db, 'userProfileData', uid)
    const userFriendsRef = collection(userProfileRef, `${collectionName}`)

    let q = query(userFriendsRef, orderBy('date', 'desc'), limit(limitNum))
    if (lastDoc) {
      q = query(q, startAfter(lastDoc))
    }
    const userFriendsSnapshot = await getDocs(q)
    const username = await getUsername()
    const numFriends = (await getNumberOfFriends(username)) || 0
    const friends: FriendsData[] = []
    const newLastDoc =
      userFriendsSnapshot.docs[userFriendsSnapshot.docs.length - 1]
    userFriendsSnapshot.forEach(doc => {
      friends.push(doc.data() as FriendsData)
    })

    return {
      friends,
      numFriends,
      newLastDoc,
    }
  } catch (error: any) {
    const message = error.message || error
    console.log(error)
    toast.error(message, { position: 'bottom-center' })
  }
}
const getAndCombineFriendsData = async (
  friends: FriendsData[]
): Promise<CombinedFriendsData[]> => {
  const cloudGetUsersFriendData = httpsCallable(
    firebaseFunctions,
    'getUsersFriendData'
  )
  const combinedUsers: any = await cloudGetUsersFriendData({
    usersFriendList: friends,
  })
  const combinedUsersData = combinedUsers.data as CombinedFriendsData[]

  return combinedUsersData
}

export const getFriends = async <B extends boolean | undefined>(
  lastDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null = null,
  options?: {
    returnUserData?: B
  }
): Promise<
  B extends true
    ? {
        friendsData: CombinedFriendsData[]
        numFriends: number
        lastDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null
      }
    : {
        friendsData: FriendsData[]
        numFriends: number
        lastDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null
      }
> => {
  try {
    const uid = auth?.currentUser?.uid
    if (uid) {
      const friendsListRes = await getListFromFriendsCollection(
        uid,
        FRIENDS,
        10,
        lastDoc
      )
      if (!friendsListRes) {
        throw new Error('Something went wrong')
      }

      const { friends, numFriends, newLastDoc } = friendsListRes

      if (options?.returnUserData) {
        const combinedUsersData = await getAndCombineFriendsData(friends)
        const returnData = {
          friendsData: combinedUsersData,
          lastDoc: newLastDoc,
          numFriends,
        }
        return returnData
      } else {
        const returnData = {
          friendsData: friends as any,
          lastDoc: newLastDoc,
          numFriends,
        }
        return returnData
      }
    }
  } catch (error: any) {
    const message = error.message || error
    console.log(error)
    toast.error(message, { position: 'bottom-center' })
  }

  return { friendsData: [], lastDoc: null, numFriends: 0 }
}
export const getNumberOfFriends = async (username: string | null = null) => {
  try {
    const uid = username
      ? await getUIDFromUsername(username)
      : auth?.currentUser?.uid
    if (uid) {
      const userProfileDataRef = doc(db, 'userProfileData', uid)
      const friendsCollection = collection(userProfileDataRef, `${FRIENDS}`)
      const totalResultsSnapshot = await getCountFromServer(friendsCollection)

      return totalResultsSnapshot.data().count
    }
  } catch (error: any) {
    const message = error.message || error
    console.log(error)
    toast.error(message, { position: 'bottom-center' })
  }
}
export const getSuggestedFriends = async () => {
  try {
    const uid = auth?.currentUser?.uid
    if (uid) {
      const cloudGetSuggestedFriends = httpsCallable(
        firebaseFunctions,
        'getSuggestedFriends'
      )
      const suggestedFriendsRes = await cloudGetSuggestedFriends({ uid })
      const suggestedFriendsData =
        suggestedFriendsRes.data as UserProfileDataType[]
      return suggestedFriendsData
    }
  } catch (error: any) {
    const message = error.message || error
    console.log(error)
    toast.error(message, { position: 'bottom-center' })
  }
}
export const getIncomingFriendRequests = async () => {
  try {
    const uid = auth?.currentUser?.uid
    if (uid) {
      const friendsListRes = await getListFromFriendsCollection(
        uid,
        INCOMING_FRIEND_REQUESTS,
        20
      )
      if (!friendsListRes) throw new Error('Something went wrong')
      const { friends: incomingFriendRequests } = friendsListRes

      const combinedUsersData = await getAndCombineFriendsData(
        incomingFriendRequests
      )

      return combinedUsersData as CombinedFriendsData[]
    }
  } catch (error: any) {
    const message = error.message || error
    console.log(error)
    toast.error(message, { position: 'bottom-center' })
  }
}
export const getOutgoingFriendRequests = async () => {
  try {
    const uid = auth?.currentUser?.uid
    if (uid) {
      const friendsListRes = await getListFromFriendsCollection(
        uid,
        OUTGOING_FRIEND_REQUESTS,
        20
      )
      if (!friendsListRes) throw new Error('Something went wrong')
      const { friends: outgoingFriendRequests } = friendsListRes

      const combinedUsersData = await getAndCombineFriendsData(
        outgoingFriendRequests
      )

      return combinedUsersData as CombinedFriendsData[]
    }
  } catch (error: any) {
    const message = error.message || error
    console.log(error)
    toast.error(message, { position: 'bottom-center' })
  }
}

// Profile pages and the suggestions list know the friend by username, but
// removeOutgoingRequest needs their UID.
export const cancelFriendRequest = async (friendUsername: string) => {
  const friendUID = await getUIDFromUsername(friendUsername)
  return removeOutgoingRequest(friendUID)
}

export const removeOutgoingRequest = async (friendUID: string) => {
  try {
    const uid = auth?.currentUser?.uid
    if (uid && friendUID) {
      const cloudRemoveOutgoingRequest = httpsCallable(
        firebaseFunctions,
        'removeOutgoingRequest'
      )
      cloudRemoveOutgoingRequest({ currUID: uid, friendUID })
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  } catch (error: any) {
    const message = error.message || error
    console.log(error)
    toast.error(message, { position: 'bottom-center' })
  }
}
export const getNumIncoming = async () => {
  try {
    const uid = auth?.currentUser?.uid
    if (uid) {
      const userProfileDataRef = doc(db, 'userProfileData', uid)
      const incomingFriendRequestsCollection = collection(
        userProfileDataRef,
        `${INCOMING_FRIEND_REQUESTS}`
      )
      const totalResultsSnapshot = await getCountFromServer(
        incomingFriendRequestsCollection
      )
      const totalResults = totalResultsSnapshot.data().count
      return totalResults
    }
  } catch (error: any) {
    const message = error.message || error
    console.log(error)
    toast.error(message, { position: 'bottom-center' })
  }
}
