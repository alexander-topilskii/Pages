    function drawPoints() {
      const R = R_WORLD * fit.s * user.s; // screen radius
      const stackHeight = R * 2; // Vertical distance between stacked points
      const maxStackRadius = R * 3; // Illustrated radius for grouped stack
      const labelOffset = stackHeight; // Space between points and their labels
      const detectedClusters = new Map();

      // Group points by identical coordinates
      for (let p of data.points || []) {
        const key = `${p.x},${p.y}`;
        if (!detectedClusters.has(key)) detectedClusters.set(key, []);
        detectedClusters.get(key).push(p);
      }

      // Handle and dynamically draw point clusters
      for (const [coords, points] of detectedClusters.entries()) {
        const [baseX, baseY] = coords.split(',').map(Number);
        const [centerX, centerY] = worldToScreen(baseX, baseY);

        // Adjust rendering for clustered points
        if (points.length > 1) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)'; // Circle indicating stack presence
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, maxStackRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          points.forEach((p, i) => {
            const offsetY = stackHeight * i; // Stack points vertically within the circle
            const pointX = centerX;
            const pointY = centerY - offsetY;

            // Draw individual point
            ctx.save();
            ctx.fillStyle = `rgba(0, ${(p.size / 100) * 255}, 255, 0.8)`; // Color by size
            ctx.beginPath();
            const adjustedRadius = Math.max(2, R - (points.length * 0.1)); // Reduce size for stack visualization
            ctx.arc(pointX, pointY, adjustedRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Position labels to avoid overlaps within stack
            const labelX = pointX + labelOffset;
            const labelY = pointY - labelOffset;

            // Draw label
            ctx.fillStyle = '#333333';
            ctx.font = '12px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(p.title, labelX, labelY);
          });
        } else {
        const [baseX, baseY] = coords.split(',').map(Number);
        const [centerX, centerY] = worldToScreen(baseX, baseY);

        if (points.length > 1) {
          // Radial layout for clustered points
          const angleStep = (2 * Math.PI) / points.length;
          points.forEach((p, i) => {
            const angle = i * angleStep;
            const offsetX = Math.cos(angle) * clusterRadius;
            const offsetY = Math.sin(angle) * clusterRadius;
            const [pointX, pointY] = [centerX + offsetX, centerY + offsetY];

            // Draw point
            ctx.save();
            ctx.fillStyle = `rgba(0, ${(p.size / 100) * 255}, 255, 0.8)`; // Color by size
            ctx.beginPath();
            ctx.arc(pointX, pointY, R, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Adjust label positions to avoid overlap
            const labelX = pointX + Math.cos(angle) * labelMargin;
            const labelY = pointY + Math.sin(angle) * labelMargin;

            // Draw label
            ctx.fillStyle = '#333333';
            ctx.font = '12px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = angle > Math.PI ? 'right' : 'left';
            ctx.textBaseline = angle > Math.PI / 2 && angle < (3 * Math.PI) / 2 ? 'bottom' : 'top';
            ctx.fillText(p.title, labelX, labelY);
          });

        } else {
          // For standalone points
          const [pointX, pointY] = worldToScreen(baseX, baseY);

          // Draw point
          ctx.save();
          ctx.fillStyle = `rgba(0, ${(points[0].size / 100) * 255}, 255, 0.8)`; // Color by size
          ctx.beginPath();
          ctx.arc(pointX, pointY, R, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Draw label
          ctx.fillStyle = '#333333';
          ctx.font = '12px "Segoe UI", Arial, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(points[0].title, pointX + labelMargin, pointY - labelMargin);
        }
      }
    }

      for (const [coords, points] of detectedClusters.entries()) {
        const [baseX, baseY] = coords.split(',').map(Number);
        const [sx, sy] = worldToScreen(baseX, baseY);

        if (points.length > 1) {
          // Arrange points in a radial pattern around the base point
          const angleStep = (2 * Math.PI) / points.length;
          points.forEach((p, i) => {
            const angle = i * angleStep;
            const offsetX = Math.cos(angle) * clusterRadius;
            const offsetY = Math.sin(angle) * clusterRadius;
            const [stackedX, stackedY] = worldToScreen(
              baseX + offsetX,
              baseY + offsetY
            );

            // Draw each point's marker
            ctx.save();
            ctx.fillStyle = `rgba(0, ${(p.size / 100) * 255}, 255, 0.8)`; // Dynamic color based on size
            ctx.beginPath();
            ctx.arc(stackedX, stackedY, R, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Render title near the stacked point
            ctx.fillStyle = '#333333';
            const dx = Math.max(2, Math.abs(R)) + 4;
            const dy = Math.max(2, Math.abs(R)) + 4;
            ctx.fillText(p.title, stackedX + dx, stackedY - dy);
          });

          // Draw a cluster circle for visibility
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)'; // Yellow circle for clusters
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, clusterRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else {
          // Draw standalone point directly if no overlap
          const [screenX, screenY] = worldToScreen(baseX, baseY);

          ctx.save();
          ctx.fillStyle = `rgba(0, ${(points[0].size / 100) * 255}, 255, 0.8)`; // Dynamic color based on size
          ctx.beginPath();
          ctx.arc(screenX, screenY, R, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Render title near the point
          ctx.fillStyle = '#333333';
          const dx = Math.max(2, Math.abs(R)) + 4;
          const dy = Math.max(2, Math.abs(R)) + 4;
          ctx.fillText(points[0].title, screenX + dx, screenY - dy);
        }
      }
    }

      for (const [coords, points] of detectedClusters.entries()) {
        const [baseX, baseY] = coords.split(',').map(Number);
        const [sx, sy] = worldToScreen(baseX, baseY);

        if (points.length > 1) {
          // Draw cluster indicator
          ctx.save();
          ctx.fillStyle = "rgba(255, 255, 0, 0.8)"; // Yellow cluster
          ctx.beginPath();
          ctx.arc(sx, sy, R * 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Add count for cluster
          ctx.fillStyle = "#000";
          ctx.font = "bold 12px Arial";
          ctx.fillText(`×${points.length}`, sx, sy);
        } else {
          // Apply jitter to avoid perfect overlap
          const jitterX = (Math.random() * 2 - 1) * jitterIntensity;
          const jitterY = (Math.random() * 2 - 1) * jitterIntensity;
          const [jitteredX, jitteredY] = worldToScreen(
            baseX + jitterX,
            baseY + jitterY
          );

          ctx.save();
          ctx.fillStyle = `rgba(0,${(points[0].size / 100) * 255},255, 0.8)`; // Dynamic color based on size
          ctx.beginPath();
          ctx.arc(jitteredX, jitteredY, R, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
