import './ProductCard.css'

const ProductCard = ({ product, onViewDetails, onAddToCart, isLoadingDetails = false }) => {
  const { name, price, image, description, rating, num_reviews, main_category } = product

  const handleAddToCart = (e) => {
    e.stopPropagation()
    onAddToCart(product)
  }

  const handleViewDetails = () => {
    onViewDetails(product)
  }

  return (
    <div className={`product-card ${isLoadingDetails ? 'loading-details' : ''}`} onClick={handleViewDetails}>
      <div className="product-image-container">
        <img src={image} alt={name} className="product-image" />
        {isLoadingDetails && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
          </div>
        )}
      </div>
      
      <div className="product-info">
        <div className="category-badge">{main_category}</div>
        <h3 className="product-name" title={name}>{name}</h3>
        
        {!isLoadingDetails && rating > 0 && (
          <div className="product-rating">
            <div className="stars">
              {[...Array(5)].map((_, i) => (
                <span 
                  key={i} 
                  className={`star ${i < Math.floor(rating) ? 'filled' : ''}`}
                >
                  ★
                </span>
              ))}
            </div>
            <span className="rating-text">
              {rating.toFixed(1)} ({num_reviews} review{num_reviews !== 1 ? 's' : ''})
            </span>
          </div>
        )}
        
        {isLoadingDetails && (
          <div className="loading-placeholder" style={{ 
            height: '20px', 
            backgroundColor: '#f0f0f0', 
            borderRadius: '4px',
            marginBottom: '8px',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}></div>
        )}
        
        <div className="product-footer">
          <span className="product-price">
            {!isLoadingDetails && price && price > 0 ? `$${price}` : 
             isLoadingDetails ? 'Loading...' : 'Price N/A'}
          </span>
          <button 
            className="add-to-cart-btn"
            onClick={handleAddToCart}
            disabled={isLoadingDetails}
            style={{ opacity: isLoadingDetails ? 0.6 : 1 }}
          >
            {isLoadingDetails ? 'Loading...' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProductCard
