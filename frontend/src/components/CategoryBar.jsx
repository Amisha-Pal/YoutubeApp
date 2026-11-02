
import { categories } from "../features/videos/videoData";

export default function CategoryBar({ activeCategory, onCategoryChange }) {
  return (
    <div className="category-bar">
      {categories.map((category) => (
        <button
          key={category}
          className={`category-chip ${
            activeCategory === category ? "active" : ""
          }`}
          onClick={() => onCategoryChange(category)}
        >
          {category}
        </button>
      ))}
    </div>
  );
}

