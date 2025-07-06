import { useState, useEffect } from 'react'
import './ProductDetails.css'

const ProductDetails = ({ product, isOpen, onClose, onAddToCart, similarItems = [], loadingSimilar = false, onViewSimilarProduct }) => {
  const [quantity, setQuantity] = useState(1)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // Handle body scroll locking when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('modal-open')
    }
  }, [isOpen])

  // Reset thumbnail state when product changes
  useEffect(() => {
    setCurrentImageIndex(0)
  }, [product])

  if (!product) return null

  const { name, price, image, description, rating, num_reviews, main_category, image_urls } = product

  // Use image_urls array if available, otherwise fallback to single image
  const productImages = image_urls && image_urls.length > 0 ? image_urls : [image]

  const handleAddToCart = () => {
    onAddToCart({
      ...product,
      quantity,
      totalPrice: price * quantity
    })
  }

  const handlePreviousImage = () => {
    setCurrentImageIndex(prev => 
      prev === 0 ? productImages.length - 1 : prev - 1
    )
  }

  const handleNextImage = () => {
    setCurrentImageIndex(prev => 
      prev === productImages.length - 1 ? 0 : prev + 1
    )
  }

  return (
    <div className={`product-details-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className="product-details-panel" onClick={(e) => e.stopPropagation()}>
        <div className="product-details-header">
          <h2>Product Details</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="product-details-content">
          <div className="product-main-content">
            <div className="product-details-left">
              <div className="product-details-image">
                <div className="main-image-container">
                  <img src={productImages[currentImageIndex]} alt={name} />
                </div>
                
                {productImages.length > 1 && (
                  <div className="image-thumbnails">
                    {productImages.map((imgUrl, index) => (
                      <img 
                        key={index}
                        src={imgUrl} 
                        alt={`${name} ${index + 1}`}
                        className={`thumbnail ${index === currentImageIndex ? 'active' : ''}`}
                        onClick={() => setCurrentImageIndex(index)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Additional details that can use space under images */}
              <div className="product-additional-details">
                <div className="product-features">
                  <h3>Product Features:</h3>
                  <ul>
                    <li>High-quality materials and construction</li>
                    <li>Durable and long-lasting design</li>
                    <li>Easy to use and maintain</li>
                    <li>Excellent customer satisfaction rating</li>
                    <li>Available in multiple sizes and colors</li>
                    <li>Free shipping on orders over $50</li>
                    <li>30-day money-back guarantee</li>
                    <li>1-year manufacturer warranty</li>
                  </ul>
                </div>
                
                <div className="product-specifications">
                  <h3>Specifications:</h3>
                  <ul>
                    <li>Weight: Varies by size</li>
                    <li>Material: Premium quality materials</li>
                    <li>Origin: Manufactured with care</li>
                    <li>Care Instructions: Follow product guidelines</li>
                    <li>Environmental Impact: Eco-friendly when possible</li>
                  </ul>
                </div>
                
                <div className="shipping-info">
                  <h3>Shipping Information:</h3>
                  <p>Standard shipping takes 3-5 business days. Express shipping available for an additional fee. Free shipping on orders over $50. International shipping available to select countries.</p>
                </div>
              </div>
            </div>

            <div className="product-details-info">
              <div className="category-badge-large">{main_category}</div>
              <h1 className="product-title">{name}</h1>
              
              {rating > 0 && (
                <div className="product-rating-large">
                  <div className="stars-large">
                    {[...Array(5)].map((_, i) => (
                      <span 
                        key={i} 
                        className={`star-large ${i < Math.floor(rating) ? 'filled' : ''}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="rating-text-large">
                    {rating.toFixed(1)} out of 5 ({num_reviews} review{num_reviews !== 1 ? 's' : ''})
                  </span>
                </div>
              )}
              
              <div className="product-price-large">
                {price && price > 0 ? `$${price}` : 'Price not available'}
              </div>

              <p className="product-description-large">{description}</p>
              
              {/* Additional content to test scrolling */}
              <div className="product-features mobile-only">
                <h3>Product Features:</h3>
                <ul>
                  <li>High-quality materials and construction</li>
                  <li>Durable and long-lasting design</li>
                  <li>Easy to use and maintain</li>
                  <li>Excellent customer satisfaction rating</li>
                  <li>Available in multiple sizes and colors</li>
                  <li>Free shipping on orders over $50</li>
                  <li>30-day money-back guarantee</li>
                  <li>1-year manufacturer warranty</li>
                </ul>
              </div>
              
              <div className="product-specifications mobile-only">
                <h3>Specifications:</h3>
                <ul>
                  <li>Weight: Varies by size</li>
                  <li>Material: Premium quality materials</li>
                  <li>Origin: Manufactured with care</li>
                  <li>Care Instructions: Follow product guidelines</li>
                  <li>Environmental Impact: Eco-friendly when possible</li>
                </ul>
              </div>
              
              <div className="shipping-info mobile-only">
                <h3>Shipping Information:</h3>
                <p>Standard shipping takes 3-5 business days. Express shipping available for an additional fee. Free shipping on orders over $50. International shipping available to select countries.</p>
              </div>

              <div className="product-options">
                <div className="option-group">
                  <label>Quantity:</label>
                  <div className="quantity-controls">
                    <button 
                      className="qty-btn" 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      -
                    </button>
                    <span className="quantity">{quantity}</span>
                    <button 
                      className="qty-btn" 
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="product-actions">
                <div className="total-price">
                  Total: ${(price * quantity).toFixed(2)}
                </div>
                <button className="add-to-cart-large" onClick={handleAddToCart}>
                  Add to Cart
                </button>
              </div>
            </div>
          </div>

          {/* Similar Items Section - spans both columns at the bottom */}
          <div className="similar-items-section">
            <h3 className="similar-items-title">Items You Might Like</h3>
            
            {loadingSimilar ? (
              <div className="similar-items-loading">
                <div className="loading-spinner-small"></div>
                <span>Loading similar items...</span>
              </div>
            ) : similarItems.length > 0 ? (
              <div className="similar-items-grid">
                {similarItems.slice(0, 50).map((item, index) => (
                  <div key={`similar-${item.id}-${index}`} className="similar-item-card">
                    <div className="similar-item-image">
                      <img 
                        src={item.image} 
                        alt={item.name}
                        onClick={() => onViewSimilarProduct && onViewSimilarProduct(item)}
                      />
                    </div>
                    <div className="similar-item-info">
                      <h4 className="similar-item-name">{item.name}</h4>
                      <div className="similar-item-price">
                        {item.price && item.price > 0 ? `$${item.price}` : 'Price not available'}
                      </div>
                      {item.rating > 0 && (
                        <div className="similar-item-rating">
                          <div className="stars-small">
                            {[...Array(5)].map((_, i) => (
                              <span 
                                key={i} 
                                className={`star-small ${i < Math.floor(item.rating) ? 'filled' : ''}`}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <span className="rating-text-small">{item.rating.toFixed(1)}</span>
                        </div>
                      )}
                      <button 
                        className="similar-item-view-btn"
                        onClick={() => onViewSimilarProduct && onViewSimilarProduct(item)}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="similar-items-empty">
                <p>No similar items found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductDetails
