import { useState, useEffect, useRef, useCallback } from 'react'
import TrackedProductCard from './TrackedProductCard'
import LoadingSpinner from './LoadingSpinner'
import ErrorMessage from './ErrorMessage'
import Notification from './Notification'
import ProductDetails from './ProductDetails'
import ShoppingCart from './ShoppingCart'
import { trackAddToCart, trackCheckout } from '../utils/analytics'
import './ShoppingPage.css'

// Function to generate a random alphanumeric user ID
const generateRandomUserId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 28 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
};

const ShoppingPage = () => {
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [userId, setUserId] = useState(() => {
    // Get or create a persistent user ID for this session
    try {
      const storedUserId = localStorage.getItem('shopping_user_id');
      if (storedUserId) {
        console.log('Retrieved stored user ID:', storedUserId);
        return storedUserId;
      } else {
        const newUserId = generateRandomUserId();
        localStorage.setItem('shopping_user_id', newUserId);
        console.log('Created new user ID:', newUserId);
        return newUserId;
      }
    } catch (error) {
      console.warn('Failed to access localStorage for user ID:', error);
      return generateRandomUserId();
    }
  })
  const [notifications, setNotifications] = useState([])
  // State to track if current user is a registered user (logged in) vs guest
  const [isLoggedInUser, setIsLoggedInUser] = useState(() => {
    try {
      const storedUserId = localStorage.getItem('shopping_user_id');
      return storedUserId && registeredUserIds.includes(storedUserId);
    } catch {
      return false;
    }
  })
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [isProductDetailsOpen, setIsProductDetailsOpen] = useState(false)
  const [similarItems, setSimilarItems] = useState([])
  const [loadingSimilarItems, setLoadingSimilarItems] = useState(false)
  const [cartItems, setCartItems] = useState([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  
  // User interaction tracking for item2item recommendations
  const [lastInteractedItem, setLastInteractedItem] = useState(null)
  const [isUsingItem2Item, setIsUsingItem2Item] = useState(false)
  const [hasRestoredI2I, setHasRestoredI2I] = useState(false)
  
  // Search functionality
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [loadingSearchDetails, setLoadingSearchDetails] = useState(false)
  const [searchDetailsProgress, setSearchDetailsProgress] = useState(0)
  
  // Category filter functionality
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [filteredRecommendations, setFilteredRecommendations] = useState([])
  const [categoryApiItems, setCategoryApiItems] = useState([]) // Additional items from category API
  
  // Lazy loading state
  const [currentPage, setCurrentPage] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreItems, setHasMoreItems] = useState(true)
  const observerRef = useRef()
  // const lastItemRef = useRef()  // unused

  // Persistence functions for i2i state
  const saveI2IStateToStorage = (item, isUsing) => {
    try {
      const i2iState = {
        lastInteractedItem: item,
        isUsingItem2Item: isUsing,
        userId: userId,
        timestamp: Date.now()
      }
      localStorage.setItem('shopping_i2i_state', JSON.stringify(i2iState))
      console.log('Saved i2i state to localStorage:', i2iState)
    } catch (error) {
      console.warn('Failed to save i2i state to localStorage:', error)
    }
  }

  const loadI2IStateFromStorage = () => {
    try {
      const storedState = localStorage.getItem('shopping_i2i_state')
      if (storedState) {
        const i2iState = JSON.parse(storedState)
        
        // Check if the stored state is recent (within 24 hours) and for the same user
        const isRecent = (Date.now() - i2iState.timestamp) < (24 * 60 * 60 * 1000)
        const isSameUser = i2iState.userId === userId
        
        if (isRecent && isSameUser && i2iState.lastInteractedItem) {
          console.log('Restored i2i state from localStorage:', i2iState)
          setLastInteractedItem(i2iState.lastInteractedItem)
          setIsUsingItem2Item(i2iState.isUsingItem2Item)
          return true
        } else {
          console.log('Stored i2i state is stale or for different user, clearing')
          localStorage.removeItem('shopping_i2i_state')
        }
      }
    } catch (error) {
      console.warn('Failed to load i2i state from localStorage:', error)
      localStorage.removeItem('shopping_i2i_state')
    }
    return false
  }

  // const clearI2IStateFromStorage = () => {
  //   try {
  //     localStorage.removeItem('shopping_i2i_state')
  //     console.log('Cleared i2i state from localStorage')
  //   } catch (error) {
  //     console.warn('Failed to clear i2i state from localStorage:', error)
  //   }
  // }

  // Cart persistence functions
  const saveCartToStorage = (cart) => {
    try {
      const cartState = {
        cartItems: cart,
        userId: userId,
        timestamp: Date.now()
      }
      localStorage.setItem('shopping_cart', JSON.stringify(cartState))
      console.log('Saved cart to localStorage:', cartState)
    } catch (error) {
      console.warn('Failed to save cart to localStorage:', error)
    }
  }

  const loadCartFromStorage = () => {
    try {
      const storedCart = localStorage.getItem('shopping_cart')
      if (storedCart) {
        const cartState = JSON.parse(storedCart)
        
        // Check if the stored cart is recent (within 7 days) and for the same user
        const isRecent = (Date.now() - cartState.timestamp) < (7 * 24 * 60 * 60 * 1000)
        const isSameUser = cartState.userId === userId
        
        if (isRecent && isSameUser && cartState.cartItems) {
          console.log('Restored cart from localStorage:', cartState)
          setCartItems(cartState.cartItems)
          if (cartState.cartItems.length > 0) {
            addNotification(`Restored ${cartState.cartItems.length} items from your previous session`, 'info')
          }
          return true
        } else {
          console.log('Stored cart is stale or for different user, clearing')
          localStorage.removeItem('shopping_cart')
        }
      }
    } catch (error) {
      console.warn('Failed to load cart from localStorage:', error)
      localStorage.removeItem('shopping_cart')
    }
    return false
  }

  const clearCartFromStorage = () => {
    try {
      localStorage.removeItem('shopping_cart')
      console.log('Cleared cart from localStorage')
    } catch (error) {
      console.warn('Failed to clear cart from localStorage:', error)
    }
  }

  // API call function to get recommendations with pagination and i2i priority
  const fetchRecommendations = async (userId, page = 0, append = false, lastItemId = null) => {
    try {
      if (!append) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }
      setError(null)
      
      // Build URL with optional last_item_id parameter for i2i prioritization
      let apiUrl = `http://138.2.61.6:20000/api/endpoint/unified?user_id=${userId}&page=${page}&limit=100`
      if (lastItemId) {
        if (Array.isArray(lastItemId)) {
          lastItemId.forEach(id => {
            apiUrl += `&last_item_id=${id}`;
          });
          console.log(`Requesting with i2i priority for items: ${lastItemId.join(',')}`);
        } else {
          apiUrl += `&last_item_id=${lastItemId}`;
          console.log(`Requesting with i2i priority for item: ${lastItemId}`);
        }
      }
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        if (response.status === 0 || !response.status) {
          throw new Error('Unable to connect to recommendation service. Please check if the service is running and CORS is properly configured.')
        }
        throw new Error(`API request failed with status ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Validate API response structure
      if (!data.recommendations || !Array.isArray(data.recommendations)) {
        throw new Error('Invalid API response format')
      }
      
      // Debug: Log pagination info
      console.log('Unified API response pagination:', data.pagination)
      console.log(`Page ${page}: received ${data.recommendations.length} items, source: ${data.pagination?.source_type}`)
      console.log(`Has more items: ${data.pagination?.has_more}`)
      
      // Update state based on source type
      if (data.pagination?.source_type === 'i2i' || data.pagination?.source_type === 'mixed') {
        setIsUsingItem2Item(true)
      }
      
      // Transform items to ensure consistent format
      const itemsWithScores = data.recommendations
        .map((item, index) => {
          if (!item) return null
          
          return {
            id: item.name ? `${item.name.slice(0, 20)}_p${page}_i${index}_${Date.now()}` : `product_${page}_${index}_${Date.now()}`,
            item_id: item.item_id || item.parent_asin || item.asin || item.id || `item_${page * 10 + index}`,
            name: item.name || `Product ${page * 10 + index + 1}`,
            score: data.score && data.score[index] !== undefined ? data.score[index] : 0,
            price: item.price && item.price !== "None" ? parseFloat(item.price) : Math.floor(Math.random() * 200) + 20,
            image: item.image_urls && Array.isArray(item.image_urls) && item.image_urls.length > 0 
              ? item.image_urls[0]
              : `https://picsum.photos/300/300?random=${page * 10 + index + 1}`,
            description: item.name ? `${item.main_category || 'Product'} - ${item.name}` : `High-quality product with excellent features and customer reviews.`,
            rating: item.rating || 0,
            num_reviews: item.num_reviews || 0,
            main_category: item.main_category || 'General',
            image_urls: item.image_urls || [],
            isItem2Item: data.pagination?.source_type === 'i2i' || data.pagination?.source_type === 'mixed'
          }
        })
        .filter(item => item !== null)
      
      const sortedItems = itemsWithScores.sort((a, b) => b.score - a.score)
      
      if (append) {
        // Append new items to existing recommendations
        setRecommendations(prev => {
          const existingIds = new Set(prev.map(item => item.item_id || item.id))
          const uniqueNewItems = sortedItems.filter(item => 
            !existingIds.has(item.item_id) && !existingIds.has(item.id)
          )
          console.log(`Appending ${uniqueNewItems.length} unique items from ${data.pagination?.source_type} source`)
          const newRecs = [...prev, ...uniqueNewItems]
          // Note: filteredRecommendations will be updated by the useEffect that watches recommendations
          return newRecs
        })
      } else {
        // Replace recommendations with new items
        setRecommendations(sortedItems)
        // Note: filteredRecommendations will be updated by the useEffect that watches recommendations
      }
      
      // Update pagination state
      setCurrentPage(page)
      setTotalItems(data.pagination?.total_items || sortedItems.length)
      setHasMoreItems(data.pagination?.has_more || false)
      
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        setError('Cannot connect to recommendation service. Please ensure the backend service is running on http://127.0.0.1:20000')
      } else {
        setError(err.message || 'Failed to fetch recommendations. Please try again.')
      }
      console.error('Error fetching recommendations:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  // Function to fetch product categories
  const fetchCategories = async () => {
    try {
      setLoadingCategories(true)
      const response = await fetch('http://138.2.61.6:20000/api/endpoint/product_categories', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error(`Categories API request failed with status ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (!data.categories || !Array.isArray(data.categories)) {
        throw new Error('Invalid categories API response format')
      }
      
      // Add "All" as the first category and filter out "None"
      const validCategories = data.categories.filter(cat => cat && cat !== "None")
      setCategories(['All', ...validCategories])
      console.log(`Loaded ${validCategories.length} product categories`)
      
    } catch (error) {
      console.error('Error fetching categories:', error)
      addNotification('Failed to load product categories', 'error')
      // Fallback categories if API fails
      setCategories(['All', 'Electronics', 'Books', 'Health & Personal Care', 'Sports & Outdoors', 'Home & Garden'])
    } finally {
      setLoadingCategories(false)
    }
  }

  // Function to filter recommendations by category
  const filterRecommendationsByCategory = (recs, category) => {
    if (!category || category === 'All') {
      return recs
    }
    
    return recs.filter(item => {
      const itemCategory = item.main_category || ''
      return itemCategory.toLowerCase().includes(category.toLowerCase()) || 
             category.toLowerCase().includes(itemCategory.toLowerCase())
    })
  }

  // Handle category selection
  const handleCategorySelect = async (category) => {
    setSelectedCategory(category)
    console.log(`Selected category: ${category}`)
    
    if (category === 'All') {
      // Show all existing recommendations - let the useEffect handle the update
      addNotification(`Showing all ${recommendations.length} products`, 'info')
      return
    }
    
    try {
      setLoadingCategories(true)
      
      // First, filter existing recommendations by category
      const existingFiltered = filterRecommendationsByCategory(recommendations, category)
      const existingIds = new Set(existingFiltered.map(item => item.item_id || item.id))
      
      // Fetch items from backend API for this category
      const response = await fetch(`http://138.2.61.6:20000/api/endpoint/categories/${encodeURIComponent(category)}?page=0&limit=50`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error(`Category API request failed with status ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('Invalid category API response format')
      }
      
      // Transform API items to match our format
      const apiItems = data.items
        .filter(item => item && !existingIds.has(item.item_id)) // Exclude items already in recommendations
        .map((item, index) => ({
          id: item.item_id ? `${item.item_id}_cat_${index}_${Date.now()}` : `cat_product_${index}_${Date.now()}`,
          item_id: item.item_id || `cat_item_${index}`,
          name: item.name || `Product ${index + 1}`,
          score: 0.5, // Default score for category items
          price: item.price && item.price !== "None" ? parseFloat(item.price) : Math.floor(Math.random() * 200) + 20,
          image: item.image_urls && Array.isArray(item.image_urls) && item.image_urls.length > 0 
            ? item.image_urls[0]
            : `https://picsum.photos/300/300?random=${index + 1000}`,
          description: item.name ? `${item.main_category || category} - ${item.name}` : `High-quality ${category} product with excellent features.`,
          rating: item.rating || 0,
          num_reviews: item.num_reviews || 0,
          main_category: item.main_category || category,
          image_urls: item.image_urls || [],
          isCategory: true
        }))
      
      // Store category API items separately so they persist when recommendations are updated
      setCategoryApiItems(apiItems)
      
      // The useEffect will handle combining filtered recommendations with category API items
      
      // Track analytics for category filter
      // trackCategoryFilter(userId, category, combinedItems.length)
      
      addNotification(`Found ${existingFiltered.length + apiItems.length} products in "${category}" (${existingFiltered.length} from recommendations, ${apiItems.length} additional)`, 'info')
      
    } catch (error) {
      console.error('Error fetching category items:', error)
      
      // Clear category API items on error
      setCategoryApiItems([])
      
      // The useEffect will handle filtering existing recommendations
      const filteredCount = filterRecommendationsByCategory(recommendations, category).length
      addNotification(`Filtered to ${filteredCount} products in "${category}" (API unavailable)`, 'warning')
    } finally {
      setLoadingCategories(false)
    }
  }

  // Load more items from the paginated backend API
  // Load more items with i2i prioritization
  const loadMoreItems = async () => {
    if (loadingMore) return

    console.log(`loadMoreItems called: currentPage=${currentPage}, hasMoreItems=${hasMoreItems}, isUsingItem2Item=${isUsingItem2Item}`)
    
    try {
      setLoadingMore(true)
      
      // Determine the best item for i2i recommendations
      let priorityItemId = null
      
      // Priority 1: Last interacted item (user showed interest)
      if (lastInteractedItem) {
        priorityItemId = lastInteractedItem.item_id || lastInteractedItem.id
        console.log(`Using last interacted item for i2i priority: ${priorityItemId}`)
      }
      // Priority 2: Random item from top 3 current recommendations (highest scored items)
      else if (recommendations.length > 0) {
        const topItems = recommendations.slice(0, 3) // Use top 3 highest-scored items
        const randomIndex = Math.floor(Math.random() * topItems.length)
        priorityItemId = topItems[randomIndex].item_id || topItems[randomIndex].id
        console.log(`Using random top item for i2i priority: ${priorityItemId}`)
      }
      
      // Always try to fetch with i2i priority if we have an item
      const nextPage = currentPage + 1
      console.log(`Attempting to load page ${nextPage} with i2i priority`)
      
      // Call unified API with i2i prioritization
      await fetchRecommendations(userId, nextPage, true, priorityItemId)
      
      setCurrentPage(nextPage)
      console.log(`Successfully loaded page ${nextPage} with i2i prioritization`)

    } catch (err) {
      console.error('Error loading more items:', err)
      setHasMoreItems(false)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    // Reset lazy loading state when user changes
    setCurrentPage(0)
    setTotalItems(0)
    setHasMoreItems(true)
    setHasRestoredI2I(false)
    
    // Reset category filter when user changes
    setSelectedCategory('All')
    setCategoryApiItems([]) // Clear category API items
    // Note: filteredRecommendations will be updated by the useEffect that watches recommendations and selectedCategory
    
    // Load item2item state from localStorage on mount
    const isRestored = loadI2IStateFromStorage()
    
    // Load cart from localStorage on mount
    loadCartFromStorage()
    
    // Fetch categories on mount
    fetchCategories()
    
    // Track page load analytics
    // trackPageLoad(userId, 'user_session')
    
    // Always fetch initial recommendations first
    fetchRecommendations(userId, 0, false)
  }, [userId])

  // Separate effect to handle restored i2i state after initial recommendations are loaded
  useEffect(() => {
    if (lastInteractedItem && userId && recommendations.length > 0 && !hasRestoredI2I) {
      console.log('Appending restored i2i recommendations for:', lastInteractedItem.name)
      setHasRestoredI2I(true)
      fetchAndAppendI2IRecommendations(lastInteractedItem)
    }
  }, [lastInteractedItem, userId, recommendations.length, hasRestoredI2I])

  // Effect to update filtered recommendations when main recommendations change
  useEffect(() => {
    if (selectedCategory === 'All') {
      setFilteredRecommendations(recommendations)
      // Clear category API items when showing all
      setCategoryApiItems([])
    } else {
      const filtered = filterRecommendationsByCategory(recommendations, selectedCategory)
      // Combine with category API items
      const combinedItems = [...filtered, ...categoryApiItems]
      setFilteredRecommendations(combinedItems)
    }
  }, [recommendations, selectedCategory, categoryApiItems])

  // Intersection Observer for infinite scroll with debouncing
  const lastItemElementRef = useCallback(node => {
    if (loadingMore) return
    if (observerRef.current) observerRef.current.disconnect()
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreItems && !loadingMore) {
        console.log('Intersection observer triggered: loading more items')
        // Debounce to prevent multiple rapid calls
        setTimeout(() => {
          if (hasMoreItems && !loadingMore) {
            loadMoreItems()
          }
        }, 100)
      }
    }, {
      threshold: 0.1,
      rootMargin: '100px'
    })
    
    if (node) observerRef.current.observe(node)
  }, [loadingMore, hasMoreItems])



  // Notification management
  const addNotification = (message, type = 'success', duration = 3000) => {
    const id = Date.now()
    const notification = { id, message, type, duration }
    // Replace all existing notifications with the new one
    setNotifications([notification])
  }

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id))
  }

  // Function to fetch and append i2i recommendations
  const fetchAndAppendI2IRecommendations = async (product) => {
    try {
      setLoadingMore(true)
      const itemId = product.item_id || product.id
      console.log(`Fetching i2i recommendations for item: ${itemId}`)
      
      // Find the next available page number for appending
      const nextPage = Math.floor(recommendations.length / 10)
      
      // Fetch i2i recommendations and append them with the correct itemId parameter
      await fetchRecommendations(userId, nextPage, true, itemId)
      
      // Removed notification for i2i recommendations
    } catch (error) {
      console.error('Error fetching i2i recommendations:', error)
      addNotification('Failed to load related items', 'error')
    } finally {
      setLoadingMore(false)
    }
  }

  // Function to fetch similar items for product details
  const fetchSimilarItems = async (product) => {
    try {
      setLoadingSimilarItems(true)
      setSimilarItems([])
      const itemId = product.item_id || product.id
      console.log(`Fetching similar items for product: ${itemId}`)
      
      // Use the unified API with i2i priority to get similar items
      let apiUrl = `http://138.2.61.6:20000/api/endpoint/unified?user_id=${userId}&page=0&limit=50&last_item_id=${itemId}`
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (!data.recommendations || !Array.isArray(data.recommendations)) {
        throw new Error('Invalid API response format')
      }
      
      // Transform and filter similar items (exclude the current product)
      const similarProducts = data.recommendations
        .map((item, index) => ({
          id: item.name ? `similar_${item.name.slice(0, 20)}_${index}_${Date.now()}` : `similar_product_${index}_${Date.now()}`,
          item_id: item.item_id || item.parent_asin || item.asin || item.id || `similar_item_${index}`,
          name: item.name || `Similar Product ${index + 1}`,
          score: data.score && data.score[index] !== undefined ? data.score[index] : 0,
          price: item.price && item.price !== "None" ? parseFloat(item.price) : Math.floor(Math.random() * 200) + 20,
          image: item.image_urls && Array.isArray(item.image_urls) && item.image_urls.length > 0 
            ? item.image_urls[0]
            : `https://picsum.photos/300/300?random=${Date.now()}_${index}`,
          description: item.name ? `${item.main_category || 'Product'} - ${item.name}` : `Similar product with excellent features.`,
          rating: item.rating || Math.floor(Math.random() * 5) + 1,
          num_reviews: item.num_reviews || Math.floor(Math.random() * 500) + 10,
          main_category: item.main_category || 'General',
          image_urls: item.image_urls || []
        }))
        .filter(item => item.item_id !== (product.item_id || product.id)) // Exclude current product
        .sort((a, b) => b.score - a.score)
        .slice(0, 50) // Limit to 20 similar items
      
      setSimilarItems(similarProducts)
      console.log(`Found ${similarProducts.length} similar items for ${product.name}`)
      
    } catch (error) {
      console.error('Error fetching similar items:', error)
      setSimilarItems([])
    } finally {
      setLoadingSimilarItems(false)
    }
  }

  // Product details management
  const handleViewProductDetails = (product) => {
    setSelectedProduct(product)
    setIsProductDetailsOpen(true)
    // Auto-collapse cart to prevent overlap with product details modal
    setIsCartOpen(false)
    
    // Track analytics for viewing product details
    // trackViewDetails(userId, product, 'card_click')
    
    // Track user interaction for item2item recommendations
    setLastInteractedItem(product)
    setIsUsingItem2Item(true)
    saveI2IStateToStorage(product, true)
    console.log(`User viewed product details: ${product.name} (${product.item_id})`)
    
    // Track i2i recommendation trigger
    // trackI2IRecommendation(userId, product.item_id, product.name)
    
    // Fetch similar items for the product details modal
    fetchSimilarItems(product)
    
    // Fetch and append related items to main recommendations
    fetchAndAppendI2IRecommendations(product)
  }

  const handleCloseProductDetails = () => {
    setIsProductDetailsOpen(false)
    setSelectedProduct(null)
    setSimilarItems([])
    setLoadingSimilarItems(false)
  }

  // Handle viewing a similar product from the similar items section
  const handleViewSimilarProduct = (similarProduct) => {
    console.log(`User clicked on similar product: ${similarProduct.name}`)
    // Close current product details and open the new one
    handleViewProductDetails(similarProduct)
  }

  // Cart management
  const handleAddToCart = (product) => {
    // Track analytics for add to cart
    trackAddToCart(userId, product, 1, 'quick_add')
    
    // Track user interaction for item2item recommendations
    setLastInteractedItem(product)
    setIsUsingItem2Item(true)
    saveI2IStateToStorage(product, true)
    // console.log(`User added to cart: ${product.name} (${product.item_id})`)
    
    // Track i2i recommendation trigger
    // trackI2IRecommendation(userId, product.item_id, product.name)
    
    // Fetch and append related items
    fetchAndAppendI2IRecommendations(product)
    
    // For quick add from card
    const cartItem = {
      ...product,
      quantity: 1,
      cartId: `${product.id}-${Date.now()}` // Unique cart ID
    }

    setCartItems(prev => {
      const existingItem = prev.find(item => 
        item.id === product.id
      )

      let newCart
      if (existingItem) {
        addNotification(`Updated quantity for "${product.name}" in cart`, 'info')
        newCart = prev.map(item =>
          item.cartId === existingItem.cartId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      } else {
        addNotification(`Added "${product.name}" to cart!`, 'success')
        newCart = [...prev, cartItem]
      }
      
      // Save to localStorage
      saveCartToStorage(newCart)
      return newCart
    })
  }

  const handleAddToCartFromDetails = (productWithOptions) => {
    // Track analytics for add to cart from details
    trackAddToCart(userId, productWithOptions, productWithOptions.quantity, 'details_modal')
    
    // Track user interaction for item2item recommendations
    setLastInteractedItem(productWithOptions)
    setIsUsingItem2Item(true)
    saveI2IStateToStorage(productWithOptions, true)
    // console.log(`User added to cart from details: ${productWithOptions.name} (${productWithOptions.item_id})`)
    
    // Track i2i recommendation trigger
    // trackI2IRecommendation(userId, productWithOptions.item_id, productWithOptions.name)
    
    // Fetch and append related items
    fetchAndAppendI2IRecommendations(productWithOptions)
    
    const cartItem = {
      ...productWithOptions,
      cartId: `${productWithOptions.id}-${Date.now()}`
    }

    setCartItems(prev => {
      const existingItem = prev.find(item => 
        item.id === productWithOptions.id
      )

      let newCart
      if (existingItem) {
        addNotification(`Updated quantity for "${productWithOptions.name}" in cart`, 'info')
        newCart = prev.map(item =>
          item.cartId === existingItem.cartId
            ? { ...item, quantity: item.quantity + productWithOptions.quantity }
            : item
        )
      } else {
        addNotification(`Added "${productWithOptions.name}" to cart!`, 'success')
        newCart = [...prev, cartItem]
      }
      
      // Save to localStorage
      saveCartToStorage(newCart)
      return newCart
    })

    handleCloseProductDetails()
  }

  const handleUpdateCartQuantity = (cartId, newQuantity) => {
    setCartItems(prev => {
      const newCart = prev.map(item =>
        item.cartId === cartId
          ? { ...item, quantity: newQuantity }
          : item
      )
      // Save to localStorage
      saveCartToStorage(newCart)
      return newCart
    })
  }

  const handleRemoveFromCart = (cartId) => {
    setCartItems(prev => {
      const item = prev.find(item => item.cartId === cartId)
      if (item) {
        addNotification(`Removed "${item.name}" from cart`, 'warning')
      }
      const newCart = prev.filter(item => item.cartId !== cartId)
      // Save to localStorage
      saveCartToStorage(newCart)
      return newCart
    })
  }

  const handleClearCart = () => {
    setCartItems([])
    clearCartFromStorage()
    addNotification('Cart cleared', 'info')
  }

  const toggleCart = () => {
    setIsCartOpen(!isCartOpen)
  }

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      addNotification('Cart is empty', 'warning')
      return
    }
    // After checkout, fetch new recommendations using all items in the cart for i2i priority
    const lastItemIds = cartItems.map(item => item.item_id || item.id);
    fetchRecommendations(userId, 0, false, lastItemIds);
    const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    // Track analytics for checkout
    trackCheckout(userId, cartItems, cartTotal)

    // Simulate checkout process
    addNotification(`Checkout successful! Total: $${cartTotal.toFixed(2)}`, 'success')
    setCartItems([])
    clearCartFromStorage()
    setIsCartOpen(false)
  }

  // Simple retry function for error recovery
  const handleRetry = () => {
    setCurrentPage(0)
    setTotalItems(0)
    setHasMoreItems(true)
    setLoadingMore(false)
    setHasRestoredI2I(false)
    fetchRecommendations(userId, 0, false)
  }

  // Search functionality
  const handleSearch = async (query) => {
    if (!query.trim()) {
      setShowSearchResults(false)
      return
    }

    setIsSearching(true)
    setSearchError(null)
    
    try {
      const response = await fetch(`http://138.2.61.6:20000/api/endpoint/search?query=${encodeURIComponent(query.trim())}&page=0&limit=100`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Search API request failed with status ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (!data.recommendations || !Array.isArray(data.recommendations)) {
        throw new Error('Invalid search API response format')
      }

      // Transform search results to match our product format with minimal details first
      const transformedResults = data.recommendations.map((item, index) => ({
        id: `search_${item.item_id}_${index}_${Date.now()}`,
        item_id: item.item_id,
        name: item.name || `Product ${item.item_id}`,
        score: data.score && data.score[index] !== undefined ? data.score[index] : 1,
        price: null, // Will be loaded lazily
        image: `https://picsum.photos/300/300?random=${item.item_id}`, // Placeholder image
        description: item.name ? `${item.main_category || 'Product'} - ${item.name}` : `Search result for "${query}" - Product ${item.item_id}`,
        rating: null, // Will be loaded lazily
        num_reviews: null, // Will be loaded lazily
        main_category: item.main_category || 'Search Result',
        image_urls: [`https://picsum.photos/300/300?random=${item.item_id}`], // Placeholder
        isSearchResult: true,
        detailsLoaded: false,
        loading: false
      }))

      setSearchResults(transformedResults)
      setShowSearchResults(true)
      addNotification(`Found ${transformedResults.length} results for "${query}"`, 'success')
      
      // Track analytics for search
      // trackSearch(userId, query, transformedResults.length)
      
      // Start lazy loading details for all items
      lazyLoadSearchDetails(transformedResults, data)
      
    } catch (error) {
      console.error('Search error:', error)
      setSearchError(error.message || 'Search failed. Please try again.')
      addNotification('Search failed. Please try again.', 'error')
    } finally {
      setIsSearching(false)
    }
  }

  // Lazy load detailed information for search results
  const lazyLoadSearchDetails = async (initialResults, originalData) => {
    setLoadingSearchDetails(true)
    setSearchDetailsProgress(0)
    
    try {
      const totalItems = initialResults.length
      const batchSize = 5 // Process 5 items at a time to avoid overwhelming the UI
      
      for (let i = 0; i < totalItems; i += batchSize) {
        const batch = initialResults.slice(i, i + batchSize)
        
        // Process each item in the batch
        const updatedBatch = batch.map((item, batchIndex) => {
          const originalIndex = i + batchIndex
          const originalItem = originalData.recommendations[originalIndex]
          
          return {
            ...item,
            price: originalItem.price && originalItem.price !== "None" 
              ? parseFloat(originalItem.price) 
              : Math.floor(Math.random() * 200) + 20,
            image: originalItem.image_urls && Array.isArray(originalItem.image_urls) && originalItem.image_urls.length > 0 
              ? originalItem.image_urls[0]
              : item.image,
            rating: originalItem.rating || Math.floor(Math.random() * 5) + 1,
            num_reviews: originalItem.num_reviews || Math.floor(Math.random() * 1000) + 10,
            image_urls: originalItem.image_urls || item.image_urls,
            detailsLoaded: true,
            loading: false
          }
        })
        
        // Update the search results with the enhanced batch
        setSearchResults(prev => {
          const updated = [...prev]
          updatedBatch.forEach((updatedItem, batchIndex) => {
            const globalIndex = i + batchIndex
            if (globalIndex < updated.length) {
              updated[globalIndex] = updatedItem
            }
          })
          return updated
        })
        
        // Update progress
        const progress = Math.min(((i + batchSize) / totalItems) * 100, 100)
        setSearchDetailsProgress(progress)
        
        // Add a small delay to make the lazy loading visible and avoid UI blocking
        if (i + batchSize < totalItems) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }
      
    } catch (error) {
      console.error('Error lazy loading search details:', error)
      addNotification('Some product details could not be loaded', 'warning')
    } finally {
      setLoadingSearchDetails(false)
      setSearchDetailsProgress(100)
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    handleSearch(searchQuery)
  }

  const handleSearchInputChange = (e) => {
    setSearchQuery(e.target.value)
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
    setSearchError(null)
    setLoadingSearchDetails(false)
    setSearchDetailsProgress(0)
    // Reset category filter when clearing search
    setSelectedCategory('All')
    // Refresh recommendations when clearing search
    fetchRecommendations(userId, 0, false)
  }

  // Debug Info box state and handlers
  const [debugInfo, setDebugInfo] = useState(null)
  const [loadingDebug, setLoadingDebug] = useState(false)
  const [debugError, setDebugError] = useState(null)
  const [showDebugBox, setShowDebugBox] = useState(false)

  const fetchDebugInfo = async () => {
    setLoadingDebug(true)
    setDebugError(null)
    try {
      const response = await fetch(`http://138.2.61.6:20000/api/debug?user_id=${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) throw new Error(`Debug API failed with status ${response.status}`)
      const data = await response.json()
      setDebugInfo(data)
      setShowDebugBox(true)
    } catch (err) {
      setDebugError(err.message || 'Failed to fetch debug info')
      setShowDebugBox(true)
    } finally {
      setLoadingDebug(false)
    }
  }

  const handleToggleDebug = () => {
    if (showDebugBox) {
      setShowDebugBox(false)
    } else {
      fetchDebugInfo()
    }
  }

  // Predefined user IDs for existing users
  const registeredUserIds = [
    'AHT36OPFBZ566CXFL6MA6UU2IQ6A', 'AHH4J4FVYCX5T3H3YQDJCVQK4QNA', 'AHODQRCZS3VYSAT4D45HN6A52LHQ',
    'AFYBDIE6SF3RXZSC2DASHMMZJGRA', 'AGCRGPW7CDWJJZZY2YVE6QCTOMXQ', 'AEGLDT443U6XGDMB7AU2SJK645HA',
    'AHCNVSHL3RP3J3BKS52FEAT2EFPQ', 'AGOWD2G7B3LURVZWRKMKIGOW3YPQ', 'AHVWWHZAQ7U46FNQP3BLW22L5R7A',
    'AHGQKYAYO5JHDAWLQZ7QKX3KKJUQ', 'AGOOLNG7OLKSENEM3RHPXFO7XAAQ', 'AF6VGYGYWE2QEMIMCI5KXVQJ7N6A',
    'AGDIM6JIATM4UPWDOVTOXR5H6W5Q', 'AGAQIBY2KT7K42ZKWGP2FVGVCUDA', 'AETLU6C2BNDZHNKU2DPIC2KCBGWQ',
    'AHYXT7RYYGGY5464JYTDSBBXBW7Q', 'AGGRCGWQWMJTOUN5M3B4AFSGRKEA', 'AFZOKI2OHUU7CIDPTMUHNIRBT4OQ',
    'AGMYTKT5C742DQYR6PGKWU6P4QAQ', 'AFARCGQHJWRPMY56QP2PDPS3YEFA', 'AGB3Q3OVF3VWZJCBCFJQADIIQA4Q',
    'AEIWLDH4XEHPT5JDHCQ6YAAFHKOQ', 'AEBGNGCGV7TKG6U2CYVWWUCNGZMA', 'AEBANPQXOZL75EBQCTNJMV5BENNA',
    'AGVRLEJEONW7DDKIBCV62VS2MLZQ', 'AF6GXWA7RCC64DE3LKCY363IPW6Q', 'AGWYPOYY4ZLEUJUECOZLK7DR2QLQ',
    'AHYOFYA7JEVLTEHLT43I4ZBYLN5A', 'AGNDIKEVVPFYPP3TSLSZXUNTEBPQ', 'AEXQJBYJGBGC73BERYC5LCEANB4Q'
  ];

  // Handler for existing user login
  const handleExistingLogin = () => {
    // Pick a different user ID than current
    const otherIds = registeredUserIds.filter(id => id !== userId);
    const selectedList = otherIds.length > 0 ? otherIds : registeredUserIds;
    const randomIndex = Math.floor(Math.random() * selectedList.length);
    const selectedId = selectedList[randomIndex];
    setUserId(selectedId);
    setIsLoggedInUser(true);
    try {
      localStorage.setItem('shopping_user_id', selectedId);
    } catch {}
    fetchRecommendations(selectedId, 0, false);
    addNotification(`Logged in as ${selectedId.slice(-8)}`, 'info');
  };

  // Handler for user logout
  const handleLogout = () => {
    // Generate a new random guest user ID
    const newGuestId = generateRandomUserId();
    setUserId(newGuestId);
    setIsLoggedInUser(false);
    try {
      localStorage.setItem('shopping_user_id', newGuestId);
    } catch {}
    fetchRecommendations(newGuestId, 0, false);
    addNotification('Logged out - now browsing as guest', 'info');
  };

  return (
    <>
      {/* Notifications - positioned relative to viewport */}
      <div className="notifications-container">
        {notifications.map(notification => (
          <Notification
            key={notification.id}
            message={notification.message}
            type={notification.type}
            duration={notification.duration}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </div>

      <div className="shopping-page">

      <header className="shopping-header" style={{ position: 'relative' }}>
       <button
         onClick={() => fetchRecommendations(userId, 0, false)}
         style={{
           position: 'absolute',
           left: '20px',
           top: '20px',
           background: 'none',
           border: 'none',
           cursor: 'pointer',
           fontSize: '1.5rem'
         }}
         title="Home"
       >🏠</button>
      {/* User authentication status */}
      <div style={{
        position: 'absolute',
        right: '20px',
        top: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        {isLoggedInUser ? (
          <>
            <span style={{ color: '#fff', fontSize: '0.9rem' }}>
              Logged in as user {userId.slice(-8)}
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: 'none',
                border: '1px solid #fff',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '0.9rem'
              }}
            >Logout</button>
          </>
        ) : (
          <>
            <span style={{ color: '#fff', fontSize: '0.9rem' }}>Existing user?</span>
            <button
              onClick={handleExistingLogin}
              style={{
                background: 'none',
                border: '1px solid #fff',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '0.9rem'
              }}
            >Login</button>
          </>
        )}
      </div>
        <h1>🛍️ Personalized Shopping Recommendations</h1>
        
        {/* Search Bar */}
        <div className="search-container" style={{ margin: '20px 0', display: 'flex', justifyContent: 'center' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center', maxWidth: '600px', width: '100%' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                placeholder="Search for products..."
                value={searchQuery}
                onChange={handleSearchInputChange}
                disabled={isSearching}
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 16px',
                  fontSize: '16px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '25px',
                  outline: 'none',
                  transition: 'border-color 0.3s',
                  backgroundColor: isSearching ? '#f5f5f5' : 'white',
                  color: 'black'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    fontSize: '18px',
                    cursor: 'pointer',
                    color: '#999'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: isSearching || !searchQuery.trim() ? '#ccc' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '25px',
                cursor: isSearching || !searchQuery.trim() ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.3s',
                minWidth: '100px'
              }}
            >
              {isSearching ? '🔍 Searching...' : '🔍 Search'}
            </button>
          </form>
        </div>
        
        <div className="controls">
          <button onClick={toggleCart} className="cart-toggle-btn">
            🛒 Cart ({cartItems.reduce((sum, item) => sum + item.quantity, 0)})
          </button>
          {cartItems.length > 0 && (
            <button onClick={handleCheckout} className="checkout-btn">
              💳 Checkout (${cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)})
            </button>
          )}
          {/* Debug Info button */}
          <button
            onClick={handleToggleDebug}
            className="debug-toggle-btn"
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: showDebugBox ? '#dc3545' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '25px',
              cursor: 'pointer',
              transition: 'background-color 0.3s',
              marginLeft: '10px'
            }}
          >
            {showDebugBox ? '🛑 Hide Debug Info' : 'ℹ️ Show Debug Info'}
          </button>
        </div>
      </header>

      {/* Debug Info Box */}
      {showDebugBox && (
        <div className="debug-box" style={{ padding: '10px', backgroundColor: '#f8f9fa', border: '1px solid #ddd', margin: '20px', borderRadius: '8px' }}>
          {loadingDebug ? (
            <LoadingSpinner />
          ) : debugError ? (
            <div style={{ color: 'red' }}>{debugError}</div>
          ) : (
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          )}
        </div>
      )}

      <main className="shopping-content">
        {loading && <LoadingSpinner />}
        
        {error && <ErrorMessage message={error} onRetry={handleRetry} />}
        
        {/* Category Filter Bar */}
        {!loading && !error && categories.length > 0 && !showSearchResults && (
          <div className="category-filter-container" style={{ 
            marginBottom: '30px',
            padding: '20px 0',
            borderBottom: '1px solid #e0e0e0'
          }}>
            <h3 style={{ 
              margin: '0 0 15px 0', 
              fontSize: '1.2rem', 
              color: '#333',
              fontWeight: '600'
            }}>
              Filter by Category
            </h3>
            <div className="category-filter-bar" style={{
              display: 'flex',
              overflowX: 'auto',
              gap: '10px',
              paddingBottom: '10px',
              scrollbarWidth: 'thin',
              scrollbarColor: '#667eea #f1f1f1'
            }}>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategorySelect(category)}
                  disabled={loadingCategories && selectedCategory === category}
                  className={`category-filter-btn ${selectedCategory === category ? 'active' : ''}`}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: '2px solid',
                    borderColor: selectedCategory === category ? '#667eea' : '#e0e0e0',
                    backgroundColor: selectedCategory === category ? '#667eea' : 'white',
                    color: selectedCategory === category ? 'white' : '#333',
                    borderRadius: '20px',
                    cursor: loadingCategories && selectedCategory === category ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    whiteSpace: 'nowrap',
                    minWidth: 'fit-content',
                    boxShadow: selectedCategory === category ? '0 2px 8px rgba(102, 126, 234, 0.3)' : 'none',
                    opacity: loadingCategories && selectedCategory === category ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (selectedCategory !== category && !(loadingCategories && selectedCategory === category)) {
                      e.target.style.borderColor = '#667eea'
                      e.target.style.backgroundColor = '#f8f9ff'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedCategory !== category && !(loadingCategories && selectedCategory === category)) {
                      e.target.style.borderColor = '#e0e0e0'
                      e.target.style.backgroundColor = 'white'
                    }
                  }}
                >
                  {loadingCategories && selectedCategory === category ? (
                    <>
                      <span style={{ marginRight: '6px' }}>⏳</span>
                      Loading...
                    </>
                  ) : (
                    <>
                      {category}
                      {selectedCategory === category && recommendations.length > 0 && (
                        <span style={{ 
                          marginLeft: '6px', 
                          fontSize: '12px',
                          backgroundColor: 'rgba(255,255,255,0.2)',
                          padding: '2px 6px',
                          borderRadius: '10px'
                        }}>
                          {category === 'All' ? recommendations.length : filteredRecommendations.length}
                        </span>
                      )}
                    </>
                  )}
                </button>
              ))}
            </div>
            {loadingCategories && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                color: '#666',
                fontSize: '14px',
                marginTop: '10px'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #e0e0e0',
                  borderTop: '2px solid #667eea',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                Loading categories...
              </div>
            )}
          </div>
        )}
        
        {/* Search Results Section */}
        {showSearchResults && (
          <>
            <div className="search-results-header" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h2>Search Results for "{searchQuery}" ({searchResults.length} items)</h2>
                <button 
                  onClick={clearSearch}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ✕ Clear Search
                </button>
              </div>
              
              {/* Lazy loading progress indicator */}
              {loadingSearchDetails && (
                <div style={{ 
                  marginBottom: '15px',
                  padding: '12px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #e9ecef'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #e0e0e0',
                      borderTop: '2px solid #667eea',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <span style={{ fontSize: '14px', color: '#666' }}>
                      Loading product details... {Math.round(searchDetailsProgress)}%
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '4px',
                    backgroundColor: '#e9ecef',
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${searchDetailsProgress}%`,
                      height: '100%',
                      backgroundColor: '#667eea',
                      transition: 'width 0.3s ease-in-out'
                    }}></div>
                  </div>
                </div>
              )}
              
              {searchError && (
                <div style={{ 
                  padding: '12px', 
                  backgroundColor: '#ffebee', 
                  color: '#c62828', 
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  {searchError}
                </div>
              )}
            </div>
            
            <div className="products-grid">
              {searchResults.map((item, index) => {
                const uniqueKey = `search_${item.id}-${index}`
                return (
                  <TrackedProductCard 
                    key={uniqueKey} 
                    product={item}
                    userId={userId}
                    source="search_results"
                    onViewDetails={handleViewProductDetails}
                    onAddToCart={handleAddToCart}
                    isLoadingDetails={!item.detailsLoaded}
                  />
                )
              })}
            </div>
            
            {searchResults.length === 0 && !isSearching && (
              <div className="empty-search-state" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <h3>No products found</h3>
                <p>Try searching with different keywords</p>
              </div>
            )}
          </>
        )}
        
        {/* Regular Recommendations Section */}
        {!showSearchResults && !loading && !error && recommendations.length > 0 && (
          <>
            <div className="recommendations-info">
              <h2>Recommended for you</h2>
              <p className="items-count">
                {selectedCategory !== 'All' && (
                  <span style={{ 
                    backgroundColor: '#667eea', 
                    color: 'white', 
                    padding: '4px 12px', 
                    borderRadius: '15px', 
                    fontSize: '14px',
                    marginRight: '10px'
                  }}>
                    {filteredRecommendations.length} items in "{selectedCategory}"
                  </span>
                )}
                {hasMoreItems && "Scroll down for more"}
              </p>
            </div>
            
            <div className="products-grid">
              {(selectedCategory === 'All' ? recommendations : filteredRecommendations).map((item, index) => {
                // Create unique key combining item.id with index to prevent duplicates
                const uniqueKey = `${item.id}-${index}`
                const source = item.isItem2Item ? 'i2i_recommendations' : 'general_recommendations'
                
                // Add ref to the last item for infinite scroll (only for unfiltered view)
                if (selectedCategory === 'All' && index === recommendations.length - 1) {
                  return (
                    <div key={uniqueKey} ref={lastItemElementRef}>
                      <TrackedProductCard 
                        product={item}
                        userId={userId}
                        source={source}
                        onViewDetails={handleViewProductDetails}
                        onAddToCart={handleAddToCart}
                      />
                    </div>
                  )
                }
                return (
                  <TrackedProductCard 
                    key={uniqueKey} 
                    product={item}
                    userId={userId}
                    source={source}
                    onViewDetails={handleViewProductDetails}
                    onAddToCart={handleAddToCart}
                  />
                )
              })}
            </div>
            
            {/* Loading indicator for infinite scroll */}
            {loadingMore && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                padding: '20px',
                color: '#666'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  fontSize: '1rem'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid #e0e0e0',
                    borderTop: '2px solid #667eea',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  {isUsingItem2Item && lastInteractedItem ? 
                    `Loading items related to "${lastInteractedItem.name}"...` : 
                    isUsingItem2Item ? 
                    'Loading related items...' : 
                    'Loading more items...'}
                </div>
              </div>
            )}
            
            {/* End of results indicator */}
            {!hasMoreItems && recommendations.length > 10 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                padding: '20px',
                color: '#999',
                fontSize: '0.9rem'
              }}>
                🎉 You've reached the end! No more items to load.
              </div>
            )}
          </>
        )}
        
        {/* Empty category filter state */}
        {!showSearchResults && !loading && !error && recommendations.length > 0 && 
         selectedCategory !== 'All' && filteredRecommendations.length === 0 && (
          <div className="empty-category-state" style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: '#666',
            backgroundColor: '#f8f9fa',
            borderRadius: '12px',
            margin: '20px 0'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>No products found in "{selectedCategory}"</h3>
            <p style={{ margin: '0 0 20px 0' }}>Try selecting a different category or browse all products</p>
            <button
              onClick={() => handleCategorySelect('All')}
              style={{
                padding: '10px 20px',
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '25px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Show All Products
            </button>
          </div>
        )}
        
        {!showSearchResults && !loading && !error && recommendations.length === 0 && (
          <div className="empty-state">
            <h3>No recommendations found</h3>
            <p>Try refreshing or changing the user ID</p>
          </div>
        )}
      </main>
      </div>

      {/* Product Details Modal - rendered outside main container for proper viewport positioning */}
      <ProductDetails
        product={selectedProduct}
        isOpen={isProductDetailsOpen}
        onClose={handleCloseProductDetails}
        onAddToCart={handleAddToCartFromDetails}
        similarItems={similarItems}
        loadingSimilar={loadingSimilarItems}
        onViewSimilarProduct={handleViewSimilarProduct}
      />

      {/* Shopping Cart Panel */}
      <ShoppingCart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
      />
    </>
  )
}

export default ShoppingPage
