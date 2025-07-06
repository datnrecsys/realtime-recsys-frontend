// Analytics utility for tracking user events

const ANALYTICS_API_URL = '/analytics/events'

/**
 * Send analytics event to the backend
 * @param {string} userId - User ID
 * @param {string} eventType - Type of event (impression, view_details, add_to_cart, checkout, search, etc.)
 * @param {string|null} itemId - Item ID (optional)
 * @param {object|null} extraData - Additional event data (optional)
 */
export const sendAnalyticsEvent = async (userId, eventType, itemId = null, extraData = null) => {
  try {
    const response = await fetch(ANALYTICS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        user_id: userId.toString(),
        event_type: eventType,
        ...(itemId && { item_id: itemId }),
        ...(extraData && { extra_data: JSON.stringify(extraData) })
      })
    })

    if (!response.ok) {
      console.warn(`Failed to send analytics event: ${response.status} ${response.statusText}`)
    } else {
      console.log(`Analytics event sent: ${eventType}`, { userId, itemId, extraData })
    }
  } catch (error) {
    console.warn('Error sending analytics event:', error)
  }
}

/**
 * Track product impression (when product is displayed)
 */
// export const trackImpression = (userId, product, source = 'recommendations') => {
//   sendAnalyticsEvent(userId, 'impression', product.item_id, {
//     product_name: product.name,
//     category: product.main_category,
//     score: product.score,
//     source: source
//   })
// }

/**
 * Track product details view
 */
// export const trackViewDetails = (userId, product, source = 'card_click') => {
//   sendAnalyticsEvent(userId, 'view_details', product.item_id, {
//     product_name: product.name,
//     category: product.main_category,
//     price: product.price,
//     rating: product.rating,
//     source: source
//   })
// }

/**
 * Track add to cart action
 */
export const trackAddToCart = (userId, product, quantity = 1, source = 'quick_add') => {
  sendAnalyticsEvent(userId, 'add_to_cart', product.item_id, {
    product_name: product.name,
    category: product.main_category,
    price: product.price,
    quantity: quantity,
    source: source
  })
}

/**
 * Track checkout action
 */
export const trackCheckout = (userId, cartItems, totalAmount) => {
  const itemIds = cartItems.map(item => item.item_id)
  const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  
  sendAnalyticsEvent(userId, 'checkout', null, {
    item_ids: itemIds,
    total_amount: totalAmount,
    total_quantity: totalQuantity,
    item_count: cartItems.length
  })
}

/**
 * Track search action
 */
// export const trackSearch = (userId, query, resultCount = 0) => {
//   sendAnalyticsEvent(userId, 'search', null, {
//     search_query: query,
//     result_count: resultCount
//   })
// }

/**
 * Track page load/session start
 */
// export const trackPageLoad = (userId, source = 'direct') => {
//   sendAnalyticsEvent(userId, 'page_load', null, {
//     source: source,
//     timestamp: new Date().toISOString()
//   })
// }

/**
 * Track recommendation refresh
 */
// export const trackRecommendationRefresh = (userId, type = 'general') => {
//   sendAnalyticsEvent(userId, 'recommendation_refresh', null, {
//     refresh_type: type
//   })
// }

/**
 * Track item-to-item recommendation trigger
 */
// export const trackI2IRecommendation = (userId, sourceItemId, sourceItemName) => {
//   sendAnalyticsEvent(userId, 'i2i_recommendation', sourceItemId, {
//     source_item_name: sourceItemName,
//     trigger_type: 'item_interaction'
//   })
// }
