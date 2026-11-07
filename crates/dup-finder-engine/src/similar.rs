//! Experimental near-duplicate images via difference hash (dHash).
//! Exact BLAKE3 groups remain the primary identity model.

use crate::error::EngineError;
use crate::mime::sniff_mime;
use image::imageops::FilterType;
use image::GrayImage;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SimilarImageGroup {
    pub dhash: String,
    pub paths: Vec<PathBuf>,
    pub max_distance: u32,
}

/// Hamming distance between equal-length hex dHash strings (64-bit → 16 hex).
pub fn hamming_hex(a: &str, b: &str) -> Option<u32> {
    if a.len() != b.len() {
        return None;
    }
    let mut dist = 0u32;
    for (ca, cb) in a.chars().zip(b.chars()) {
        let va = ca.to_digit(16)?;
        let vb = cb.to_digit(16)?;
        dist += (va ^ vb).count_ones();
    }
    Some(dist)
}

/// 64-bit difference hash as 16 lowercase hex chars.
pub fn dhash_image(path: &Path) -> Result<String, EngineError> {
    let img = image::open(path).map_err(|e| EngineError::Message(format!("image:{e}")))?;
    let gray = img.to_luma8();
    // 9x8 so we get 8 horizontal comparisons per row × 8 rows = 64 bits
    let small: GrayImage = image::imageops::resize(&gray, 9, 8, FilterType::Triangle);
    let mut bits: u64 = 0;
    let mut bit_i = 0u32;
    for y in 0..8 {
        for x in 0..8 {
            let left = small.get_pixel(x, y).0[0];
            let right = small.get_pixel(x + 1, y).0[0];
            if left > right {
                bits |= 1u64 << bit_i;
            }
            bit_i += 1;
        }
    }
    Ok(format!("{bits:016x}"))
}

fn is_image_path(path: &Path) -> bool {
    sniff_mime(path).starts_with("image/")
}

/// Cluster images whose dHash Hamming distance ≤ `threshold` (default 10).
/// Exact BLAKE3 duplicates should already be handled separately.
pub fn find_similar_images(
    paths: &[PathBuf],
    threshold: u32,
) -> Result<Vec<SimilarImageGroup>, EngineError> {
    let mut hashed: Vec<(PathBuf, String)> = Vec::new();
    for p in paths {
        if !is_image_path(p) {
            continue;
        }
        match dhash_image(p) {
            Ok(h) => hashed.push((p.clone(), h)),
            Err(_) => continue,
        }
    }
    // Union-find style clustering by pairwise distance
    let n = hashed.len();
    let mut parent: Vec<usize> = (0..n).collect();
    fn find(parent: &mut [usize], i: usize) -> usize {
        if parent[i] != i {
            parent[i] = find(parent, parent[i]);
        }
        parent[i]
    }
    fn unite(parent: &mut [usize], a: usize, b: usize) {
        let ra = find(parent, a);
        let rb = find(parent, b);
        if ra != rb {
            parent[rb] = ra;
        }
    }
    for i in 0..n {
        for j in (i + 1)..n {
            if let Some(d) = hamming_hex(&hashed[i].1, &hashed[j].1) {
                if d <= threshold {
                    unite(&mut parent, i, j);
                }
            }
        }
    }
    let mut clusters: HashMap<usize, Vec<usize>> = HashMap::new();
    for i in 0..n {
        clusters.entry(find(&mut parent, i)).or_default().push(i);
    }
    let mut out = Vec::new();
    for members in clusters.values() {
        if members.len() < 2 {
            continue;
        }
        let mut max_d = 0u32;
        for a in 0..members.len() {
            for b in (a + 1)..members.len() {
                if let Some(d) = hamming_hex(&hashed[members[a]].1, &hashed[members[b]].1) {
                    max_d = max_d.max(d);
                }
            }
        }
        let paths: Vec<PathBuf> = members.iter().map(|&i| hashed[i].0.clone()).collect();
        out.push(SimilarImageGroup {
            dhash: hashed[members[0]].1.clone(),
            paths,
            max_distance: max_d,
        });
    }
    out.sort_by(|a, b| b.paths.len().cmp(&a.paths.len()));
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgb, RgbImage};
    use tempfile::tempdir;

    fn write_solid_png(path: &Path, r: u8, g: u8, b: u8) {
        let mut img = RgbImage::new(32, 32);
        for p in img.pixels_mut() {
            *p = Rgb([r, g, b]);
        }
        img.save(path).unwrap();
    }

    #[test]
    fn similar_solid_colors_cluster() {
        let dir = tempdir().unwrap();
        let a = dir.path().join("a.png");
        let b = dir.path().join("b.png");
        let c = dir.path().join("c.png");
        write_solid_png(&a, 10, 10, 10);
        write_solid_png(&b, 12, 12, 12); // nearly same → similar dHash
        write_solid_png(&c, 255, 0, 0); // different
        let groups = find_similar_images(&[a, b, c], 10).unwrap();
        assert!(
            groups.iter().any(|g| g.paths.len() >= 2),
            "expected a similar pair, got {groups:?}"
        );
    }

    #[test]
    fn hamming_identical_zero() {
        assert_eq!(hamming_hex("abcd", "abcd"), Some(0));
    }
}
