import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { FaUserFriends, FaSearch, FaUserPlus, FaTrash, FaCheck, FaTimes } from 'react-icons/fa'
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  getDoc,
  setDoc,
  Timestamp,
  writeBatch
} from 'firebase/firestore'
import { firestore } from '../firebase/config'

interface User {
  uid: string
  displayName: string
  email: string
}

interface FriendRequest {
  id: string
  sender: User
  receiver: string
  receiverName?: string
  receiverEmail?: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: Date
}

const Friends = () => {
  const { currentUser } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [friends, setFriends] = useState<User[]>([])
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([])
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Fetch user's friends and friend requests
  useEffect(() => {
    if (!currentUser) return

    const fetchFriendsAndRequests = async () => {
      try {
        setLoading(true)
        setError('') // Clear any previous errors
        
        // Get current user's friend list
        try {
          const userDoc = await getDocs(query(
            collection(firestore, 'users'),
            where('uid', '==', currentUser.uid)
          ))
          
          if (!userDoc.empty) {
            const userData = userDoc.docs[0].data()
            const friendIds = userData.friends || []
            
            if (friendIds.length > 0) {
              try {
                // Fetch friend details
                const friendsQuery = query(
                  collection(firestore, 'users'),
                  where('uid', 'in', friendIds)
                )
                
                const friendDocs = await getDocs(friendsQuery)
                const friendsList: User[] = []
                
                friendDocs.forEach(doc => {
                  const data = doc.data()
                  friendsList.push({
                    uid: data.uid,
                    displayName: data.displayName,
                    email: data.email
                  })
                })
                
                setFriends(friendsList)
              } catch (friendFetchErr) {
                console.error('Error fetching friend details:', friendFetchErr)
                // Continue with empty friends list
                setFriends([])
              }
            } else {
              setFriends([])
            }
          } else {
            // User document not found, might be a new user
            setFriends([])
          }
        } catch (userFetchErr) {
          console.error('Error fetching user document:', userFetchErr)
          // Continue with empty friends list
          setFriends([])
        }

        // Try to fetch friend requests, but don't fail if collection doesn't exist
        try {
          // Fetch sent friend requests
          const sentRequestsQuery = query(
            collection(firestore, 'friendRequests'),
            where('senderId', '==', currentUser.uid),
            where('status', '==', 'pending')
          )
          
          const sentRequestsSnapshot = await getDocs(sentRequestsQuery)
          const sentRequestsList: FriendRequest[] = []
          
          for (const reqDoc of sentRequestsSnapshot.docs) {
            const reqData = reqDoc.data()
            
            try {
              // Get receiver details
              const receiverDoc = await getDoc(doc(firestore, 'users', reqData.receiverId))
              if (receiverDoc.exists()) {
                const receiverData = receiverDoc.data();
                sentRequestsList.push({
                  id: reqDoc.id,
                  sender: {
                    uid: currentUser.uid,
                    displayName: currentUser.displayName || 'Unknown',
                    email: currentUser.email || ''
                  },
                  receiver: reqData.receiverId,
                  receiverName: receiverData.displayName || 'Unknown User',
                  receiverEmail: receiverData.email || '',
                  status: reqData.status,
                  createdAt: reqData.createdAt?.toDate() || new Date()
                })
              }
            } catch (receiverErr) {
              console.warn('Error fetching receiver details:', receiverErr)
              // Skip this request
            }
          }
          
          setSentRequests(sentRequestsList)
          
          // Fetch received friend requests
          const receivedRequestsQuery = query(
            collection(firestore, 'friendRequests'),
            where('receiverId', '==', currentUser.uid),
            where('status', '==', 'pending')
          )
          
          const receivedRequestsSnapshot = await getDocs(receivedRequestsQuery)
          const receivedRequestsList: FriendRequest[] = []
          
          for (const reqDoc of receivedRequestsSnapshot.docs) {
            const reqData = reqDoc.data()
            
            try {
              // Get sender details
              const senderDoc = await getDoc(doc(firestore, 'users', reqData.senderId))
              if (senderDoc.exists()) {
                const senderData = senderDoc.data()
                
                receivedRequestsList.push({
                  id: reqDoc.id,
                  sender: {
                    uid: reqData.senderId,
                    displayName: senderData.displayName || 'Unknown User',
                    email: senderData.email || ''
                  },
                  receiver: currentUser.uid,
                  receiverName: currentUser.displayName || 'Unknown',
                  receiverEmail: currentUser.email || '',
                  status: reqData.status,
                  createdAt: reqData.createdAt?.toDate() || new Date()
                })
              }
            } catch (senderErr) {
              console.warn('Error fetching sender details:', senderErr)
              // Skip this request
            }
          }
          
          setReceivedRequests(receivedRequestsList)
        } catch (requestsErr) {
          console.warn('Error fetching friend requests:', requestsErr)
          // This might happen if the friendRequests collection doesn't exist yet
          setSentRequests([])
          setReceivedRequests([])
        }
      } catch (err: any) {
        console.error('Error in fetchFriendsAndRequests:', err)
        setError('Failed to load friends and requests: ' + (err.message || 'Unknown error'))
      } finally {
        setLoading(false)
      }
    }

    fetchFriendsAndRequests()
  }, [currentUser])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!searchTerm.trim()) return
    
    try {
      setLoading(true)
      setError('')
      
      // First try to search by email (exact match)
      const emailQuery = query(
        collection(firestore, 'users'),
        where('email', '==', searchTerm.trim().toLowerCase())
      )
      
      const emailResults = await getDocs(emailQuery)
      let results: User[] = []
      
      emailResults.forEach(doc => {
        const data = doc.data()
        if (data.uid !== currentUser?.uid) {
          results.push({
            uid: data.uid,
            displayName: data.displayName || 'Unknown User',
            email: data.email
          })
        }
      })
      
      // If no results by email, try display name search
      if (results.length === 0) {
        // Search for users by display name (case insensitive if possible)
        const usersQuery = query(
          collection(firestore, 'users'),
          where('displayName', '>=', searchTerm),
          where('displayName', '<=', searchTerm + '\uf8ff')
        )
        
        const userDocs = await getDocs(usersQuery)
        
        userDocs.forEach(doc => {
          const data = doc.data()
          // Don't include current user in results
          if (data.uid !== currentUser?.uid) {
            results.push({
              uid: data.uid,
              displayName: data.displayName || 'Unknown User',
              email: data.email
            })
          }
        })
      }
      
      // If still no results, show a helpful message
      if (results.length === 0) {
        setError(`No users found matching "${searchTerm}". Try searching by exact email address.`)
      }
      
      setSearchResults(results)
    } catch (err: any) {
      console.error('Error searching users:', err)
      setError('Failed to search users: ' + (err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const sendFriendRequest = async (user: User) => {
    if (!currentUser) return
    
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      
      // Check if the user document exists first
      const userDocRef = doc(firestore, 'users', user.uid)
      const userDocSnap = await getDoc(userDocRef)
      
      if (!userDocSnap.exists()) {
        throw new Error(`User document for ${user.displayName} not found`)
      }
      
      try {
        // Check if there's already a pending request between these users
        const existingSentQuery = query(
          collection(firestore, 'friendRequests'),
          where('senderId', '==', currentUser.uid),
          where('receiverId', '==', user.uid),
          where('status', '==', 'pending')
        )
        
        const existingReceivedQuery = query(
          collection(firestore, 'friendRequests'),
          where('senderId', '==', user.uid),
          where('receiverId', '==', currentUser.uid),
          where('status', '==', 'pending')
        )
        
        const [sentSnap, receivedSnap] = await Promise.all([
          getDocs(existingSentQuery),
          getDocs(existingReceivedQuery)
        ])
        
        if (!sentSnap.empty) {
          setError('You already sent a friend request to this user')
          return
        }
        
        if (!receivedSnap.empty) {
          setError('This user already sent you a friend request. Check your received requests.')
          return
        }
      } catch (checkErr) {
        // If there's an error checking existing requests (e.g., collection doesn't exist),
        // we can continue since we'll create the collection
        console.warn('Error checking existing requests:', checkErr)
      }
      
      // Check if they're already friends
      const currentUserDoc = await getDoc(doc(firestore, 'users', currentUser.uid))
      if (currentUserDoc.exists()) {
        const userData = currentUserDoc.data()
        if (userData.friends && userData.friends.includes(user.uid)) {
          setError('You are already friends with this user')
          return
        }
      }
      
      // Create a new friend request
      const requestData = {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Unknown',
        senderEmail: currentUser.email || '',
        receiverId: user.uid,
        receiverName: user.displayName || 'Unknown',
        receiverEmail: user.email || '',
        status: 'pending',
        createdAt: Timestamp.now()
      }
      
      try {
        // Create a new document in the friendRequests collection
        const requestRef = doc(collection(firestore, 'friendRequests'))
        await setDoc(requestRef, requestData)
        
        // Add to local state
        setSentRequests(prev => [...prev, {
          id: requestRef.id,
          sender: {
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'Unknown',
            email: currentUser.email || ''
          },
          receiver: user.uid,
          receiverName: user.displayName || 'Unknown User',
          receiverEmail: user.email || '',
          status: 'pending',
          createdAt: new Date()
        }])
        
        // Remove from search results
        setSearchResults(prev => prev.filter(u => u.uid !== user.uid))
        
        setSuccess(`Friend request sent to ${user.displayName}!`)
      } catch (writeErr: any) {
        console.error('Error writing friend request to Firestore:', writeErr)
        if (writeErr.code === 'permission-denied') {
          setError('Failed to send friend request: Missing or insufficient permissions. Please make sure you have updated your Firebase security rules.')
        } else {
          throw writeErr; // Re-throw to be caught by the outer catch
        }
      }
    } catch (err: any) {
      console.error('Error sending friend request:', err)
      setError('Failed to send friend request: ' + (err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const removeFriend = async (user: User) => {
    if (!currentUser) return
    
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      
      // Get document references
      const currentUserDocRef = doc(firestore, 'users', currentUser.uid);
      const otherUserDocRef = doc(firestore, 'users', user.uid);
      
      // Make sure other user exists before trying to update
      const otherUserDoc = await getDoc(otherUserDocRef);
      if (!otherUserDoc.exists()) {
        throw new Error(`User document for ${user.displayName} not found`);
      }
      
      console.log(`Attempting to remove friendship between ${currentUser.uid} and ${user.uid}`);
      
      // First, update the current user's document
      console.log("Updating current user's document...");
      await updateDoc(currentUserDocRef, {
        friends: arrayRemove(user.uid)
      });
      console.log("Successfully updated current user's document");
      
      // Important: Ensure the other user's document is updated as well
      console.log("Updating other user's document...");
      let otherUserUpdateSuccessful = false;
      
      try {
        await updateDoc(otherUserDocRef, {
          friends: arrayRemove(currentUser.uid)
        });
        otherUserUpdateSuccessful = true;
        console.log("Successfully updated other user's document");
      } catch (updateError: any) {
        console.error('Failed to update other user document:', updateError);
        console.error('Error details:', updateError.code, updateError.message);
        
        // Try a different approach with security rules in mind
        try {
          console.log("Trying alternative update approach...");
          // Get the other user's current data
          const otherUserData = otherUserDoc.data();
          const currentFriends = otherUserData.friends || [];
          
          // If the current user is in their friends list
          if (currentFriends.includes(currentUser.uid)) {
            // Create a new friends array without the current user
            const newFriends = currentFriends.filter((friendId: string) => friendId !== currentUser.uid);
            
            // Update with the new array instead of using arrayRemove
            await updateDoc(otherUserDocRef, {
              friends: newFriends
            });
            otherUserUpdateSuccessful = true;
            console.log("Successfully updated other user's document with alternative approach");
          } else {
            console.log("Current user not found in other user's friends list - no update needed");
            otherUserUpdateSuccessful = true; // No update needed, so consider it successful
          }
        } catch (alternativeUpdateError: any) {
          console.error('Alternative update approach also failed:', alternativeUpdateError);
          console.error('Error details:', alternativeUpdateError.code, alternativeUpdateError.message);
        }
      }
      
      // Update local friends list
      setFriends(prev => prev.filter(f => f.uid !== user.uid));
      
      if (otherUserUpdateSuccessful) {
        setSuccess(`${user.displayName} removed from your friends`);
      } else {
        setSuccess(`${user.displayName} removed from your friends, but there was an issue updating their friends list. They may still see you as a friend.`);
      }
    } catch (err: any) {
      console.error('Error removing friend:', err);
      setError('Failed to remove friend: ' + (err.message || 'Unknown error'));
      
      // Attempt to verify and fix any inconsistency
      try {
        // Check if the friendship is in an inconsistent state
        const currentUserDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
        const otherUserDoc = await getDoc(doc(firestore, 'users', user.uid));
        
        if (currentUserDoc.exists() && otherUserDoc.exists()) {
          const currentUserData = currentUserDoc.data();
          const otherUserData = otherUserDoc.data();
          
          const currentUserHasFriend = currentUserData.friends && currentUserData.friends.includes(user.uid);
          const otherUserHasFriend = otherUserData.friends && otherUserData.friends.includes(currentUser.uid);
          
          // If there's an inconsistency, try to fix it
          if (currentUserHasFriend !== otherUserHasFriend) {
            console.log('Detected inconsistent friendship state, attempting to fix...');
            
            if (currentUserHasFriend) {
              // Remove from current user if still there
              await updateDoc(doc(firestore, 'users', currentUser.uid), {
                friends: arrayRemove(user.uid)
              });
            }
            
            if (otherUserHasFriend) {
              // Remove from other user if still there
              await updateDoc(doc(firestore, 'users', user.uid), {
                friends: arrayRemove(currentUser.uid)
              });
            }
            
            setSuccess('Fixed inconsistent friendship state');
          }
        }
      } catch (fixErr) {
        console.error('Error attempting to fix friendship inconsistency:', fixErr);
      }
    } finally {
      setLoading(false);
    }
  }

  const acceptFriendRequest = async (request: FriendRequest) => {
    if (!currentUser) return
    
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      
      console.log('Accepting friend request:', request.id, 'from:', request.sender.displayName);
      
      // 1. Update the request status to accepted
      const requestRef = doc(firestore, 'friendRequests', request.id)
      await updateDoc(requestRef, {
        status: 'accepted'
      })
      console.log('Successfully updated friend request status to accepted');
      
      // Get references to both user documents
      const currentUserRef = doc(firestore, 'users', currentUser.uid)
      const senderRef = doc(firestore, 'users', request.sender.uid)
      
      // Check if current user document exists and get its data
      const currentUserDoc = await getDoc(currentUserRef);
      if (!currentUserDoc.exists()) {
        throw new Error("Your user document does not exist");
      }
      const currentUserData = currentUserDoc.data();
      
      // Check if sender document exists and get its data
      const senderDoc = await getDoc(senderRef);
      if (!senderDoc.exists()) {
        throw new Error(`User document for ${request.sender.displayName} not found`);
      }
      const senderData = senderDoc.data();
      
      // Create a batch for atomic updates
      const batch = writeBatch(firestore);
      
      // Check if the friendship already exists on either side
      const currentUserFriends = currentUserData.friends || [];
      const senderFriends = senderData.friends || [];
      
      // 2. Update current user's friends list if needed
      if (!currentUserFriends.includes(request.sender.uid)) {
        console.log('Adding sender to current user friends list');
        batch.update(currentUserRef, {
          friends: arrayUnion(request.sender.uid)
        });
      } else {
        console.log('Sender already in current user friends list');
      }
      
      // 3. Update sender's friends list if needed
      if (!senderFriends.includes(currentUser.uid)) {
        console.log('Adding current user to sender friends list');
        batch.update(senderRef, {
          friends: arrayUnion(currentUser.uid)
        });
      } else {
        console.log('Current user already in sender friends list');
      }
      
      // 4. Commit the batch
      await batch.commit();
      console.log('Successfully updated both user documents');
      
      // 5. Update local state
      if (!currentUserFriends.includes(request.sender.uid)) {
        setFriends(prev => [...prev, request.sender]);
      }
      setReceivedRequests(prev => prev.filter(r => r.id !== request.id));
      
      setSuccess(`You are now friends with ${request.sender.displayName}!`);
    } catch (err: any) {
      console.error('Error accepting friend request:', err);
      setError('Failed to accept friend request: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }
  
  const rejectFriendRequest = async (request: FriendRequest) => {
    if (!currentUser) return
    
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      
      // Update the request status to rejected
      const requestRef = doc(firestore, 'friendRequests', request.id)
      await updateDoc(requestRef, {
        status: 'rejected'
      })
      
      // Update local state
      setReceivedRequests(prev => prev.filter(r => r.id !== request.id))
      
      setSuccess(`Friend request from ${request.sender.displayName} rejected`)
    } catch (err: any) {
      console.error('Error rejecting friend request:', err)
      setError('Failed to reject friend request: ' + (err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }
  
  const cancelFriendRequest = async (request: FriendRequest) => {
    if (!currentUser) return
    
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      
      // Delete the friend request
      const requestRef = doc(firestore, 'friendRequests', request.id)
      await updateDoc(requestRef, {
        status: 'cancelled'
      })
      
      // Update local state
      setSentRequests(prev => prev.filter(r => r.id !== request.id))
      
      setSuccess(`Friend request to ${request.receiverName || 'user'} cancelled`)
    } catch (err: any) {
      console.error('Error cancelling friend request:', err)
      setError('Failed to cancel friend request: ' + (err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 flex items-center">
        <FaUserFriends className="mr-2" /> Friends
      </h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}
      
      {/* Friend Search */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Find Friends</h2>
        <form onSubmit={handleSearch} className="flex mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email"
            className="flex-grow p-2 border rounded-l"
          />
          <button 
            type="submit" 
            className="bg-blue-500 text-white p-2 rounded-r flex items-center"
            disabled={loading}
          >
            <FaSearch className="mr-2" /> Search
          </button>
        </form>
        
        {searchResults.length > 0 && (
          <div className="mt-4">
            <h3 className="text-lg font-medium mb-2">Search Results</h3>
            <div className="space-y-2">
              {searchResults.map(user => (
                <div key={user.uid} className="border p-3 rounded flex justify-between items-center">
                  <div>
                    <div className="font-medium">{user.displayName}</div>
                    <div className="text-sm text-gray-600">{user.email}</div>
                  </div>
                  <button
                    onClick={() => sendFriendRequest(user)}
                    className="btn btn-secondary flex items-center space-x-1"
                    disabled={loading || friends.some(f => f.uid === user.uid)}
                  >
                    <FaUserPlus className="mr-1" /> Add Friend
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Friend Requests */}
      {receivedRequests.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Friend Requests</h2>
          <div className="space-y-2">
            {receivedRequests.map(request => (
              <div key={request.id} className="border p-3 rounded flex justify-between items-center">
                <div>
                  <div className="font-medium">{request.sender.displayName}</div>
                  <div className="text-sm text-gray-600">{request.sender.email}</div>
                  <div className="text-xs text-gray-500">
                    Sent {new Date(request.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => acceptFriendRequest(request)}
                    className="bg-green-500 text-white px-3 py-1 rounded flex items-center"
                    disabled={loading}
                  >
                    <FaCheck className="mr-1" /> Accept
                  </button>
                  <button
                    onClick={() => rejectFriendRequest(request)}
                    className="bg-red-500 text-white px-3 py-1 rounded flex items-center"
                    disabled={loading}
                  >
                    <FaTimes className="mr-1" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Sent Requests */}
      {sentRequests.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Sent Requests</h2>
          <div className="space-y-2">
            {sentRequests.map(request => (
              <div key={request.id} className="border p-3 rounded flex justify-between items-center">
                <div>
                  <div className="font-medium">To: {request.receiverName || 'Unknown User'}</div>
                  <div className="text-sm text-gray-600">{request.receiverEmail || ''}</div>
                  <div className="text-xs text-gray-500">
                    Sent {new Date(request.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => cancelFriendRequest(request)}
                  className="bg-gray-500 text-white px-3 py-1 rounded flex items-center"
                  disabled={loading}
                >
                  <FaTimes className="mr-1" /> Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Friends List */}
      <div>
        <h2 className="text-xl font-semibold mb-4">My Friends</h2>
        {friends.length === 0 ? (
          <p className="text-gray-500">You don't have any friends yet.</p>
        ) : (
          <div className="space-y-2">
            {friends.map(friend => (
              <div key={friend.uid} className="border p-3 rounded flex justify-between items-center">
                <div>
                  <div className="font-medium">{friend.displayName}</div>
                  <div className="text-sm text-gray-600">{friend.email}</div>
                </div>
                <button
                  onClick={() => removeFriend(friend)}
                  className="bg-red-500 text-white px-3 py-1 rounded flex items-center"
                  disabled={loading}
                >
                  <FaTrash className="mr-1" /> Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Friends 