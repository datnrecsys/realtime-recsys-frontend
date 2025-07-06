import { useEffect, useRef } from 'react'
import ProductCard from './ProductCard'
// import { trackImpression } from '../utils/analytics'

const TrackedProductCard = ({ 
  product, 
  userId, 
  source = 'recommendations',
  // onViewDetails, 
  onAddToCart,
  isLoadingDetails,
  ...props 
}) => {
  const cardRef = useRef(null)
  const hasTrackedRef = useRef(false)

  useEffect(() => {
    if (!product || !userId || hasTrackedRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTrackedRef.current) {
            // Track impression when product becomes visible
            // trackImpression(userId, product, source)
            hasTrackedRef.current = true
            observer.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.5, // Track when 50% of the card is visible
        rootMargin: '0px 0px -50px 0px' // Small margin to ensure card is actually viewed
      }
    )

    if (cardRef.current) {
      observer.observe(cardRef.current)
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current)
      }
    }
  }, [product, userId, source])

  return (
    <div ref={cardRef}>
      <ProductCard
        product={product}
        // onViewDetails={onViewDetails}
        onAddToCart={onAddToCart}
        isLoadingDetails={isLoadingDetails}
        {...props}
      />
    </div>
  )
}

export default TrackedProductCard
